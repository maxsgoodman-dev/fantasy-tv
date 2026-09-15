'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { scoreWeeklyPick } from '@/lib/scoring/weekly'
import type { WeeklyScoringConfig } from '@/lib/scoring/types'
import { revalidatePath } from 'next/cache'

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
