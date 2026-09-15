'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

export async function createWeeklyQuestion(leagueId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const episodeId = String(formData.get('episodeId'))
  const questionText = String(formData.get('questionText'))
  const eventTypeTarget = String(formData.get('eventTypeTarget'))
  const lockAt = String(formData.get('lockAt'))

  await supabase.from('weekly_questions').insert({
    league_id: leagueId,
    episode_id: episodeId,
    question_text: questionText,
    event_type_target: eventTypeTarget,
    lock_at: lockAt,
  })
  revalidatePath(`/admin/leagues/${leagueId}/questions`)
}
