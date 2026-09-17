import { describe, expect, it } from 'vitest'
import { scoreDraftPick } from './survival-draft'

describe('scoreDraftPick', () => {
  it('awards 0 when no eliminations have happened yet', () => {
    const points = scoreDraftPick({ contestantId: 'jordan' }, [])
    expect(points).toBe(0)
  })

  it('awards the sum of round numbers for a pick that has survived every elimination so far', () => {
    // eliminations 1, 2, 3 have happened; jordan wasn't eliminated in any of them
    const points = scoreDraftPick({ contestantId: 'jordan' }, [
      { contestantId: 'sam', round: 1 },
      { contestantId: 'alex', round: 2 },
      { contestantId: 'casey', round: 3 },
    ])
    expect(points).toBe(1 + 2 + 3)
  })

  it('stops accruing points at the round a pick is eliminated (that round itself scores 0)', () => {
    const points = scoreDraftPick({ contestantId: 'jordan' }, [
      { contestantId: 'sam', round: 1 },
      { contestantId: 'jordan', round: 2 },
      { contestantId: 'casey', round: 3 },
    ])
    // survived round 1 (+1), eliminated at round 2 (+0), round 3 doesn't count
    expect(points).toBe(1)
  })

  it('awards 0 for a pick eliminated in the very first round', () => {
    const points = scoreDraftPick({ contestantId: 'jordan' }, [{ contestantId: 'jordan', round: 1 }])
    expect(points).toBe(0)
  })
})
