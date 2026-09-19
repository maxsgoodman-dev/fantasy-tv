import { describe, expect, it } from 'vitest'
import { buildOverrides, effectivePoints, effectiveRules, readOverrides } from './league-rules'
import { BAKEOFF_RULES } from './bakeoff-rules'

describe('effectivePoints', () => {
  it('uses the override when one exists for the code', () => {
    expect(effectivePoints('star_baker', 2, { star_baker: 5 })).toBe(5)
  })
  it('falls back to logged points otherwise', () => {
    expect(effectivePoints('star_baker', 2, {})).toBe(2)
    expect(effectivePoints(null, 7, { star_baker: 5 })).toBe(7)
  })
  it('honors an override of zero', () => {
    expect(effectivePoints('hand_shake', 1, { hand_shake: 0 })).toBe(0)
  })
})

describe('effectiveRules', () => {
  it('marks modified rules and keeps the base value', () => {
    const rules = effectiveRules(BAKEOFF_RULES, { star_baker: 3 })
    const star = rules.find((r) => r.code === 'star_baker')!
    expect(star).toMatchObject({ points: 3, basePoints: 2, modified: true })
    expect(rules.find((r) => r.code === 'pass_round')!.modified).toBe(false)
  })
})

describe('buildOverrides', () => {
  it('keeps only changed integer values', () => {
    const result = buildOverrides(BAKEOFF_RULES, { star_baker: '3', pass_round: '1', hand_shake: 'abc', win_technical: '' })
    expect(result).toEqual({ star_baker: 3 })
  })
  it('allows negative and zero values', () => {
    expect(buildOverrides(BAKEOFF_RULES, { pass_round: '0', hand_shake: '-1' })).toEqual({ pass_round: 0, hand_shake: -1 })
  })
})

describe('readOverrides', () => {
  it('ignores malformed data', () => {
    expect(readOverrides(null)).toEqual({})
    expect(readOverrides([1, 2])).toEqual({})
    expect(readOverrides({ a: 2, b: 'x' })).toEqual({ a: 2 })
  })
})
