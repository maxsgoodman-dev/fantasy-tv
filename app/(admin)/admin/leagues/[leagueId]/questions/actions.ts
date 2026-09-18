'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { findRuleAcrossSets } from '@/lib/scoring/rulesets'
import { postScoredEvent } from '@/lib/scoring/post-event'
import { revalidatePath } from 'next/cache'

export async function logContestantEvent(leagueId: string, episodeId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const contestantId = String(formData.get('contestantId'))
  const eventCode = String(formData.get('eventCode'))

  const rule = findRuleAcrossSets(eventCode)
  if (!rule) return

  await postScoredEvent(supabase, { episodeId, contestantId, rule })

  revalidatePath(`/admin/leagues/${leagueId}/questions`)
  revalidatePath(`/leagues/${leagueId}`)
}

export async function deleteContestantEvent(leagueId: string, eventId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('contestant_episode_events').delete().eq('id', eventId)
  revalidatePath(`/admin/leagues/${leagueId}/questions`)
  revalidatePath(`/leagues/${leagueId}`)
}
