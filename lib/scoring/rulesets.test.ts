import { describe, it, expect } from 'vitest'
import { rulesetForShowName, isBakeoffShow } from './rulesets'
import { BAKEOFF_RULES } from './bakeoff-rules'
import { TRAITORS_RULES } from './traitors-rules'

describe('rulesetForShowName', () => {
  it('uses the Bake Off rulebook for every Bake Off title', () => {
    for (const name of ['Great British Baking Show', 'The Great British Bake Off', 'Bake Off']) {
      expect(isBakeoffShow(name)).toBe(true)
      expect(rulesetForShowName(name)).toBe(BAKEOFF_RULES)
    }
  })
  it('uses the Traitors rulebook otherwise', () => {
    expect(rulesetForShowName('Traitors')).toBe(TRAITORS_RULES)
  })
})
