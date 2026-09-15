'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { scoreBracketPick } from '@/lib/scoring/bracket'
import type { BracketScoringConfig } from '@/lib/scoring/types'
import { revalidatePath } from 'next/cache'

export async function seedRoundOne(leagueId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const contestantIds = formData.getAll('contestantId') as string[]

  const matchups = []
  for (let i = 0; i < contestantIds.length; i += 2) {
    matchups.push({
      league_id: leagueId,
      round: 1,
      matchup_index: i / 2,
      contestant_a_id: contestantIds[i],
      contestant_b_id: contestantIds[i + 1] ?? null,
    })
  }
  await supabase.from('bracket_matchups').insert(matchups)
  revalidatePath(`/admin/leagues/${leagueId}/bracket`)
}

export async function setMatchupWinner(leagueId: string, matchupId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const winnerId = String(formData.get('winnerId'))

  const { data: matchup } = await supabase
    .from('bracket_matchups')
    .select('round, matchup_index, leagues(scoring_config)')
    .eq('id', matchupId)
    .single()

  await supabase
    .from('bracket_matchups')
    .update({ winner_id: winnerId, resolved_at: new Date().toISOString() })
    .eq('id', matchupId)

  const scoringConfig = (matchup!.leagues as unknown as { scoring_config: BracketScoringConfig })
    .scoring_config

  const { data: picks } = await supabase
    .from('member_bracket_picks')
    .select('id, predicted_winner_id')
    .eq('matchup_id', matchupId)

  for (const pick of picks ?? []) {
    const points = scoreBracketPick(
      { predictedWinnerId: pick.predicted_winner_id },
      { round: matchup!.round, winnerId },
      scoringConfig
    )
    await supabase.from('member_bracket_picks').update({ points_awarded: points }).eq('id', pick.id)
  }

  // Advance the winner into the next round's matchup, creating it if needed.
  const nextRound = matchup!.round + 1
  const nextMatchupIndex = Math.floor(matchup!.matchup_index / 2)
  const slot = matchup!.matchup_index % 2 === 0 ? 'contestant_a_id' : 'contestant_b_id'

  const { data: existingNext } = await supabase
    .from('bracket_matchups')
    .select('id')
    .eq('league_id', leagueId)
    .eq('round', nextRound)
    .eq('matchup_index', nextMatchupIndex)
    .maybeSingle()

  if (existingNext) {
    await supabase.from('bracket_matchups').update({ [slot]: winnerId }).eq('id', existingNext.id)
  } else {
    await supabase.from('bracket_matchups').insert({
      league_id: leagueId,
      round: nextRound,
      matchup_index: nextMatchupIndex,
      [slot]: winnerId,
    })
  }

  revalidatePath(`/admin/leagues/${leagueId}/bracket`)
}
