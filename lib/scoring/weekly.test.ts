import { describe, expect, it } from 'vitest'
import { scoreWeeklyPick } from './weekly'
import type { WeeklyScoringConfig } from './types'

const config: WeeklyScoringConfig = { format: 'weekly_vote', defaultPointsPerCorrect: 5 }

describe('scoreWeeklyPick', () => {
  it('awards default points when the pick matches the resolved answer', () => {
    const result = scoreWeeklyPick(
      { pickedContestantId: 'jordan' },
      { id: 'q1', resolvedCorrectContestantId: 'jordan', pointValue: 1 },
      config
    )
    expect(result).toEqual({ isCorrect: true, pointsAwarded: 5 })
  })

  it('awards zero points when the pick does not match', () => {
    const result = scoreWeeklyPick(
      { pickedContestantId: 'sam' },
      { id: 'q1', resolvedCorrectContestantId: 'jordan', pointValue: 1 },
      config
    )
    expect(result).toEqual({ isCorrect: false, pointsAwarded: 0 })
  })

  it('awards zero points when the question is not yet resolved', () => {
    const result = scoreWeeklyPick(
      { pickedContestantId: 'jordan' },
      { id: 'q1', resolvedCorrectContestantId: null, pointValue: 1 },
      config
    )
    expect(result).toEqual({ isCorrect: false, pointsAwarded: 0 })
  })

  it('uses a per-question point override when present', () => {
    const overrideConfig: WeeklyScoringConfig = {
      format: 'weekly_vote',
      defaultPointsPerCorrect: 5,
      questionOverrides: { q1: 20 },
    }
    const result = scoreWeeklyPick(
      { pickedContestantId: 'jordan' },
      { id: 'q1', resolvedCorrectContestantId: 'jordan', pointValue: 1 },
      overrideConfig
    )
    expect(result).toEqual({ isCorrect: true, pointsAwarded: 20 })
  })
})
