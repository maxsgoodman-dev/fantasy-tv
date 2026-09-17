export interface LineupPick {
  contestantId: string
}

export interface ContestantEventPoints {
  contestantId: string
  points: number
}

/**
 * A member's score for one episode = the sum of every logged event's points
 * for each contestant on their lineup that episode.
 */
export function scoreWeeklyLineup(picks: LineupPick[], events: ContestantEventPoints[]): number {
  const pointsByContestant = new Map<string, number>()
  for (const event of events) {
    pointsByContestant.set(event.contestantId, (pointsByContestant.get(event.contestantId) ?? 0) + event.points)
  }
  return picks.reduce((total, pick) => total + (pointsByContestant.get(pick.contestantId) ?? 0), 0)
}
