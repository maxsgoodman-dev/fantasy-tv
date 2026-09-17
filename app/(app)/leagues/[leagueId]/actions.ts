'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitPick(leagueId: string, questionId: string, contestantId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase
    .from('member_picks')
    .upsert(
      { weekly_question_id: questionId, user_id: user!.id, picked_contestant_id: contestantId },
      { onConflict: 'weekly_question_id,user_id' }
    )

  revalidatePath(`/leagues/${leagueId}`)
}

export async function submitBracketPick(leagueId: string, matchupId: string, predictedWinnerId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase
    .from('member_bracket_picks')
    .upsert(
      { matchup_id: matchupId, user_id: user!.id, predicted_winner_id: predictedWinnerId },
      { onConflict: 'matchup_id,user_id' }
    )

  revalidatePath(`/leagues/${leagueId}`)
}
