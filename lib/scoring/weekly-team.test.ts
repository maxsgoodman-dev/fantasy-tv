import { describe, expect, it } from 'vitest'
import { scoreWeeklyLineup } from './weekly-team'

describe('scoreWeeklyLineup', () => {
  it('sums a single event for a single picked contestant', () => {
    const total = scoreWeeklyLineup(
      [{ contestantId: 'jordan' }],
      [{ contestantId: 'jordan', points: 8 }]
    )
    expect(total).toBe(8)
  })

  it('sums multiple events logged for the same contestant', () => {
    const total = scoreWeeklyLineup(
      [{ contestantId: 'jordan' }],
      [
        { contestantId: 'jordan', points: 8 },
        { contestantId: 'jordan', points: -2 },
        { contestantId: 'jordan', points: 3 },
      ]
    )
    expect(total).toBe(9)
  })

  it('sums across multiple picked contestants', () => {
    const total = scoreWeeklyLineup(
      [{ contestantId: 'jordan' }, { contestantId: 'sam' }],
      [
        { contestantId: 'jordan', points: 8 },
        { contestantId: 'sam', points: -6 },
      ]
    )
    expect(total).toBe(2)
  })

  it('ignores events for contestants not on the lineup', () => {
    const total = scoreWeeklyLineup(
      [{ contestantId: 'jordan' }],
      [
        { contestantId: 'jordan', points: 8 },
        { contestantId: 'someone-else', points: 25 },
      ]
    )
    expect(total).toBe(8)
  })

  it('returns 0 for a pick with no logged events', () => {
    const total = scoreWeeklyLineup([{ contestantId: 'jordan' }], [])
    expect(total).toBe(0)
  })
})
