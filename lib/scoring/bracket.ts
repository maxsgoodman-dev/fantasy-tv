import type { BracketScoringConfig } from './types'

export interface BracketPick {
  predictedWinnerId: string
}

export interface BracketMatchupResult {
  round: number
  winnerId: string | null
}

export function scoreBracketPick(
  pick: BracketPick,
  matchup: BracketMatchupResult,
  config: BracketScoringConfig
): number {
  if (!matchup.winnerId) return 0
  if (pick.predictedWinnerId !== matchup.winnerId) return 0

  const roundIndex = matchup.round - 1
  return config.roundPoints[roundIndex] ?? 0
}
