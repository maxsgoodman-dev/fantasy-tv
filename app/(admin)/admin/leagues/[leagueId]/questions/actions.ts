'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { findRule } from '@/lib/scoring/traitors-rules'
import { revalidatePath } from 'next/cache'

export async function logContestantEvent(leagueId: string, episodeId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const contestantId = String(formData.get('contestantId'))
  const eventCode = String(formData.get('eventCode'))

  const rule = findRule(eventCode)
  if (!rule) return

  await supabase.from('contestant_episode_events').insert({
    episode_id: episodeId,
    contestant_id: contestantId,
    event_code: rule.code,
    label: rule.label,
    points: rule.points,
  })

  revalidatePath(`/admin/leagues/${leagueId}/questions`)
  revalidatePath(`/leagues/${leagueId}`)
}

export async function deleteContestantEvent(leagueId: string, eventId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('contestant_episode_events').delete().eq('id', eventId)
  revalidatePath(`/admin/leagues/${leagueId}/questions`)
  revalidatePath(`/leagues/${leagueId}`)
}
