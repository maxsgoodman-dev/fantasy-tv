'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'
import { resend } from '@/lib/email/resend'
import { resultsPostedEmail } from '@/lib/email/templates'

export async function addEpisodeEvent(episodeId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const eventType = String(formData.get('eventType'))
  const contestantId = String(formData.get('contestantId'))
  const description = String(formData.get('description') ?? '')

  await supabase.from('episode_events').insert({
    episode_id: episodeId,
    event_type: eventType,
    contestant_id: contestantId,
    description,
  })

  await supabase.from('episodes').update({ status: 'results_posted' }).eq('id', episodeId)
  revalidatePath(`/admin/episodes/${episodeId}`)

  await sendResultsPostedEmails(episodeId)
}

async function sendResultsPostedEmails(episodeId: string) {
  const { supabase } = await requireAdmin()
  const { data: episode } = await supabase
    .from('episodes')
    .select('episode_number, season_id')
    .eq('id', episodeId)
    .single()
  if (!episode) return

  // Every league for this episode's season cares about results being
  // posted — weekly_vote leagues because their per-episode scoring just
  // updated, bracket/draft leagues because an elimination may have
  // affected their standings.
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, name, league_members(user_id)')
    .eq('season_id', episode.season_id)

  const { data: userEmails } = await supabase.auth.admin.listUsers()

  const seen = new Set<string>()
  for (const league of leagues ?? []) {
    const leagueMembers = league.league_members as unknown as { user_id: string }[]
    for (const member of leagueMembers) {
      const key = `${league.id}:${member.user_id}`
      if (seen.has(key)) continue
      seen.add(key)
      const authUser = userEmails.users.find((u) => u.id === member.user_id)
      if (!authUser?.email) continue
      const { subject, text } = resultsPostedEmail(league.name, episode.episode_number)
      await resend.emails.send({ from: 'Fantasy TV <notify@fantasytv.app>', to: authUser.email, subject, text })
    }
  }
}
