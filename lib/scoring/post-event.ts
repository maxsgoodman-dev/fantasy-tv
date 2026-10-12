import type { ScoringRule } from './traitors-rules'

/** Scoring rules that mean the contestant is out of the game. */
const ELIMINATING_CODES = new Set(['murdered', 'banished_faithful', 'banished_traitor'])

export function isEliminatingCode(code: string): boolean {
  return ELIMINATING_CODES.has(code)
}

/** A row this call inserted, so a caller can undo a partially-applied batch. */
export interface InsertedRow {
  table: 'contestant_episode_events' | 'episode_events'
  id: string
}

/**
 * The single way a scored event gets written: inserts the points row that the
 * scoring engine reads, and — for rules that knock a contestant out — also
 * records the "eliminated" marker that drives the Still in / Eliminated
 * status display (skipped if that marker already exists).
 *
 * Throws if a write fails (it used to ignore errors, which silently dropped
 * points). Returns the rows it inserted so callers can roll back.
 */
export async function postScoredEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  args: { episodeId: string; contestantId: string; rule: Pick<ScoringRule, 'code' | 'label' | 'points'>; label?: string }
): Promise<InsertedRow[]> {
  const { episodeId, contestantId, rule } = args
  const inserted: InsertedRow[] = []

  const { data, error } = await supabase
    .from('contestant_episode_events')
    .insert({
      episode_id: episodeId,
      contestant_id: contestantId,
      event_code: rule.code,
      label: args.label ?? rule.label,
      points: rule.points,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Could not post "${rule.label}": ${error?.message ?? 'no row returned'}`)
  inserted.push({ table: 'contestant_episode_events', id: data.id })

  if (isEliminatingCode(rule.code)) {
    const markerId = await markEliminated(supabase, episodeId, contestantId, args.label ?? rule.label)
    if (markerId) inserted.push({ table: 'episode_events', id: markerId })
  }
  return inserted
}

/** Returns the new marker's id, or null if the contestant was already marked eliminated. */
export async function markEliminated(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  episodeId: string,
  contestantId: string,
  description: string
): Promise<string | null> {
  const { data: existing, error: lookupError } = await supabase
    .from('episode_events')
    .select('id')
    .eq('episode_id', episodeId)
    .eq('contestant_id', contestantId)
    .eq('event_type', 'eliminated')
    .limit(1)
  if (lookupError) throw new Error(`Could not check elimination status: ${lookupError.message}`)
  if (existing && existing.length > 0) return null

  const { data, error } = await supabase
    .from('episode_events')
    .insert({ episode_id: episodeId, contestant_id: contestantId, event_type: 'eliminated', description })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Could not mark eliminated: ${error?.message ?? 'no row returned'}`)
  return data.id as string
}

/** Best-effort undo of rows a failed batch already inserted. */
export async function rollbackInserted(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: InsertedRow[]
) {
  for (const row of rows) {
    await supabase.from(row.table).delete().eq('id', row.id)
  }
}
