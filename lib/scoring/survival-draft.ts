export interface DraftPick {
  contestantId: string
}

export interface Elimination {
  contestantId: string
  /** 1-based elimination order, chronological (1st elimination, 2nd, ...). */
  round: number
}

/**
 * A drafted contestant earns their round number in points for every
 * elimination round they're still in the competition for. The round they
 * themselves get eliminated in scores 0 (not "correct" that round), and no
 * later rounds count once they're out.
 */
export function scoreDraftPick(pick: DraftPick, eliminations: Elimination[]): number {
  const maxRound = eliminations.reduce((max, e) => Math.max(max, e.round), 0)
  const myElimination = eliminations.find((e) => e.contestantId === pick.contestantId)
  const survivedThroughRound = myElimination ? myElimination.round - 1 : maxRound

  let total = 0
  for (let round = 1; round <= survivedThroughRound; round++) {
    total += round
  }
  return total
}
