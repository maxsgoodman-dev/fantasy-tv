import type { WeeklyScoringConfig } from './types'

export interface WeeklyPick {
  pickedContestantId: string
}

export interface WeeklyQuestionResult {
  id: string
  resolvedCorrectContestantId: string | null
  pointValue: number
}

export function scoreWeeklyPick(
  pick: WeeklyPick,
  question: WeeklyQuestionResult,
  config: WeeklyScoringConfig
): { isCorrect: boolean; pointsAwarded: number } {
  if (!question.resolvedCorrectContestantId) {
    return { isCorrect: false, pointsAwarded: 0 }
  }

  const isCorrect = pick.pickedContestantId === question.resolvedCorrectContestantId
  if (!isCorrect) {
    return { isCorrect: false, pointsAwarded: 0 }
  }

  const points = config.questionOverrides?.[question.id] ?? config.defaultPointsPerCorrect
  return { isCorrect: true, pointsAwarded: points }
}
