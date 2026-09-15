export interface WeeklyScoringConfig {
  format: 'weekly_vote'
  defaultPointsPerCorrect: number
  questionOverrides?: Record<string, number>
}

export interface BracketScoringConfig {
  format: 'bracket'
  roundPoints: number[]
}

export type ScoringConfig = WeeklyScoringConfig | BracketScoringConfig
