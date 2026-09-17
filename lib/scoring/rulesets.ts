import { TRAITORS_RULES, type ScoringRule } from './traitors-rules'
import { BAKEOFF_RULES } from './bakeoff-rules'

/**
 * Picks a scoring rulebook by show name. A simple name-based heuristic is
 * enough for the two shows this app currently supports; if more shows with
 * their own rulebooks are added later, this should become a real per-show
 * setting instead.
 */
export function rulesetForShowName(showName: string | null | undefined): ScoringRule[] {
  if (showName && /bake/i.test(showName)) return BAKEOFF_RULES
  return TRAITORS_RULES
}

export function findRuleAcrossSets(code: string): ScoringRule | undefined {
  return [...TRAITORS_RULES, ...BAKEOFF_RULES].find((r) => r.code === code)
}
