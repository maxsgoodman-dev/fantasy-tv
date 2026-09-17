export interface ScoringRule {
  code: string
  category: string
  label: string
  points: number
}

/**
 * Default weekly-team scoring rulebook (Traitors-style: pick a team each
 * episode, score points from granular things each pick says/does).
 * Snapshot as a fixed constant — logged events store a copy of the point
 * value at the time they're entered, so changing this list later doesn't
 * retroactively rewrite history.
 */
export const TRAITORS_RULES: ScoringRule[] = [
  { code: 'mission_earn', category: 'Missions', label: 'Retrieves gold / individually earns prize money during a Mission', points: 8 },
  { code: 'mission_shield', category: 'Missions', label: 'Grabs a shield during a Mission and/or secures immunity from Murder', points: 12 },
  { code: 'mission_fail', category: 'Missions', label: "Gets eliminated from or doesn't participate in a Mission", points: -3 },

  { code: 'roundtable_first_speak', category: 'Round Table & Eliminations', label: 'First person to speak at Round Table', points: 3 },
  { code: 'roundtable_zero_votes', category: 'Round Table & Eliminations', label: 'Receives 0 votes against them at the Round Table', points: 6 },
  { code: 'faithful_votes_traitor', category: 'Round Table & Eliminations', label: 'Faithful votes for a Traitor at Banishment (2x if successful)', points: 11 },
  { code: 'vote_against', category: 'Round Table & Eliminations', label: 'Each vote against contestant at Banishment (-2 once half the cast is eliminated)', points: -1 },
  { code: 'faithful_votes_faithful', category: 'Round Table & Eliminations', label: 'Faithful votes for another Faithful at Banishment', points: -4 },
  { code: 'murdered', category: 'Round Table & Eliminations', label: 'Gets Murdered', points: -6 },
  { code: 'banished_faithful', category: 'Round Table & Eliminations', label: 'Gets Banished as a Faithful', points: -7 },
  { code: 'banished_traitor', category: 'Round Table & Eliminations', label: 'Gets Banished as a Traitor', points: -10 },

  { code: 'first_group_breakfast', category: 'Did You See That?', label: 'In the first group to walk into breakfast', points: 3 },
  { code: 'traitor_writes_name', category: 'Did You See That?', label: 'Traitor seen writing the name of a Faithful to murder/recruit', points: 4 },
  { code: 'cries', category: 'Did You See That?', label: 'Cries (tear must be seen on cheek/wiped away)', points: -2 },

  { code: 'name_thrown_out', category: 'Making Moves', label: "References someone's name being thrown out there / written down", points: 3 },
  { code: 'strategy_word', category: 'Making Moves', label: 'Says "strategy," "blindside," or something being good for their game', points: 4 },
  { code: 'big_move', category: 'Making Moves', label: 'References "taking a shot" or "making a big/huge move"', points: 5 },
  { code: 'private_conversation', category: 'Making Moves', label: 'Asks someone to leave a room / steals someone for a private conversation', points: 6 },

  { code: 'referred_trustworthy', category: 'Do You Trust Me?', label: 'Referred to by another contestant as trusted/trustworthy', points: 7 },
  { code: 'referred_suspicious', category: 'Do You Trust Me?', label: "Referred to as someone that can't be trusted / a threat", points: -5 },

  { code: 'mentions_past_season', category: 'Classic Traitors Moments', label: 'Mentions a previous Traitors contestant/season by name or number', points: 3 },
  { code: 'mentions_prize', category: 'Classic Traitors Moments', label: 'References the prize money / who or what they are playing for', points: 4 },

  { code: 'first_correct_vote', category: 'Early Birds Get The Worms', label: 'First Faithfuls to correctly vote for a Traitor at Banishment (per Traitor)', points: 5 },
  { code: 'wins_season', category: 'Early Birds Get The Worms', label: 'Wins the prize money at the end of the season', points: 25 },
  { code: 'first_faithful_banished', category: 'Early Birds Get The Worms', label: 'First Faithful to get Banished', points: -4 },
  { code: 'first_traitor_banished', category: 'Early Birds Get The Worms', label: 'First Traitor to get Banished', points: -6 },
]

export function findRule(code: string): ScoringRule | undefined {
  return TRAITORS_RULES.find((r) => r.code === code)
}
