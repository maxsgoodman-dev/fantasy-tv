'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { scoreWeeklyPick } from '@/lib/scoring/weekly'
import type { WeeklyScoringConfig } from '@/lib/scoring/types'
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

  await resolveWeeklyQuestionsForEpisode(episodeId)
  await supabase.from('episodes').update({ status: 'results_posted' }).eq('id', episodeId)
  revalidatePath(`/admin/episodes/${episodeId}`)

  await sendResultsPostedEmails(episodeId)
}

async function sendResultsPostedEmails(episodeId: string) {
  const { supabase } = await requireAdmin()
  const { data: episode } = await supabase
    .from('episodes')
    .select('episode_number')
    .eq('id', episodeId)
    .single()

  const { data: leagueMembers } = await supabase
    .from('weekly_questions')
    .select('leagues(id, name, league_members(profiles(display_name), user_id))')
    .eq('episode_id', episodeId)

  const { data: userEmails } = await supabase.auth.admin.listUsers()

  const seen = new Set<string>()
  for (const row of leagueMembers ?? []) {
    const league = row.leagues as unknown as {
      id: string
      name: string
      league_members: { user_id: string }[]
    }
    for (const member of league.league_members) {
      const key = `${league.id}:${member.user_id}`
      if (seen.has(key)) continue
      seen.add(key)
      const authUser = userEmails.users.find((u) => u.id === member.user_id)
      if (!authUser?.email) continue
      const { subject, text } = resultsPostedEmail(league.name, episode!.episode_number)
      await resend.emails.send({ from: 'Fantasy TV <notify@fantasytv.app>', to: authUser.email, subject, text })
    }
  }
}

async function resolveWeeklyQuestionsForEpisode(episodeId: string) {
  const { supabase } = await requireAdmin()

  const { data: events } = await supabase
    .from('episode_events')
    .select('event_type, contestant_id')
    .eq('episode_id', episodeId)

  const { data: questions } = await supabase
    .from('weekly_questions')
    .select('id, event_type_target, point_value, leagues(scoring_config)')
    .eq('episode_id', episodeId)
    .is('resolved_at', null)

  for (const question of questions ?? []) {
    const matchingEvent = events?.find((e) => e.event_type === question.event_type_target)
    if (!matchingEvent) continue

    await supabase
      .from('weekly_questions')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_correct_contestant_id: matchingEvent.contestant_id,
      })
      .eq('id', question.id)

    const scoringConfig = (question.leagues as unknown as { scoring_config: WeeklyScoringConfig })
      .scoring_config

    const { data: picks } = await supabase
      .from('member_picks')
      .select('id, picked_contestant_id')
      .eq('weekly_question_id', question.id)

    for (const pick of picks ?? []) {
      const { isCorrect, pointsAwarded } = scoreWeeklyPick(
        { pickedContestantId: pick.picked_contestant_id },
        {
          id: question.id,
          resolvedCorrectContestantId: matchingEvent.contestant_id,
          pointValue: question.point_value,
        },
        scoringConfig
      )
      await supabase
        .from('member_picks')
        .update({ is_correct: isCorrect, points_awarded: pointsAwarded })
        .eq('id', pick.id)
    }
  }
}
