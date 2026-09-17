export type SuggestedEvent = {
  contestantName: string
  episodeNumber: number
  eventCode: string
  label: string
  points: number
  /** 'score' events post to contestant_episode_events; 'eliminated' just marks status. */
  kind: 'score' | 'eliminated'
}

export type WikiParser = 'bakeoff_wiki' | 'traitors_wiki'
