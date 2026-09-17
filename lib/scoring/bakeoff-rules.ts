import type { ScoringRule } from './traitors-rules'

/**
 * Default season-draft scoring rulebook (Bake Off-style: draft a team once,
 * each baker earns stackable points every episode they're still in).
 */
export const BAKEOFF_RULES: ScoringRule[] = [
  { code: 'pass_round', category: 'Weekly', label: 'Passes the round (not eliminated this episode)', points: 1 },
  { code: 'win_technical', category: 'Weekly', label: 'Wins the Technical Challenge', points: 1 },
  { code: 'star_baker', category: 'Weekly', label: 'Named Star Baker', points: 2 },
  { code: 'hand_shake', category: 'Weekly', label: 'Gets a Hollywood Handshake', points: 1 },
  { code: 'season_winner', category: 'Season', label: 'Wins the season', points: 5 },
]

export function findBakeoffRule(code: string): ScoringRule | undefined {
  return BAKEOFF_RULES.find((r) => r.code === code)
}
