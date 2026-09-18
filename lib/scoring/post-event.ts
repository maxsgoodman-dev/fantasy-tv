import type { ScoringRule } from './traitors-rules'

/** Scoring rules that mean the contestant is out of the game. */
const ELIMINATING_CODES = new Set(['murdered', 'banished_faithful', 'banished_traitor'])

export function isEliminatingCode(code: string): boolean {
  return ELIMINATING_CODES.has(code)
}

/**
 * The single way a scored event gets written: inserts the points row that the
 * scoring engine reads, and — for rules that knock a contestant out — also
 * records the "eliminated" marker that drives the Still in / Eliminated
 * status display (skipped if that marker already exists).
 */
export async function postScoredEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  args: { episodeId: string; contestantId: string; rule: Pick<ScoringRule, 'code' | 'label' | 'points'>; label?: string }
) {
  const { episodeId, contestantId, rule } = args

  await supabase.from('contestant_episode_events').insert({
    episode_id: episodeId,
    contestant_id: contestantId,
    event_code: rule.code,
    label: args.label ?? rule.label,
    points: rule.points,
  })

  if (isEliminatingCode(rule.code)) {
    await markEliminated(supabase, episodeId, contestantId, args.label ?? rule.label)
  }
}

export async function markEliminated(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  episodeId: string,
  contestantId: string,
  description: string
) {
  const { data: existing } = await supabase
    .from('episode_events')
    .select('id')
    .eq('episode_id', episodeId)
    .eq('contestant_id', contestantId)
    .eq('event_type', 'eliminated')
    .limit(1)
  if (existing && existing.length > 0) return

  await supabase.from('episode_events').insert({
    episode_id: episodeId,
    contestant_id: contestantId,
    event_type: 'eliminated',
    description,
  })
}
