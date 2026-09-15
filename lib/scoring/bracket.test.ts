import { describe, expect, it } from 'vitest'
import { scoreBracketPick } from './bracket'
import type { BracketScoringConfig } from './types'

const config: BracketScoringConfig = { format: 'bracket', roundPoints: [1, 2, 4, 8] }

describe('scoreBracketPick', () => {
  it('awards round-1 points for a correct round-1 pick', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'jordan' },
      { round: 1, winnerId: 'jordan' },
      config
    )
    expect(points).toBe(1)
  })

  it('awards round-3 points for a correct round-3 pick', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'jordan' },
      { round: 3, winnerId: 'jordan' },
      config
    )
    expect(points).toBe(4)
  })

  it('awards zero points for an incorrect pick', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'sam' },
      { round: 1, winnerId: 'jordan' },
      config
    )
    expect(points).toBe(0)
  })

  it('awards zero points when the matchup has no winner yet', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'jordan' },
      { round: 1, winnerId: null },
      config
    )
    expect(points).toBe(0)
  })

  it('falls back to zero for a round beyond the configured point list', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'jordan' },
      { round: 9, winnerId: 'jordan' },
      config
    )
    expect(points).toBe(0)
  })
})
