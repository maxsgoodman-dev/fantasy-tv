import { fetchWikiPage } from './fetch-source'
import { parseBakeoffWiki, diffBakeoffSnapshots, type BakeoffSnapshot } from './parse-bakeoff-wiki'
import { parseTraitorsWiki, diffTraitorsSnapshots, type TraitorsSnapshot } from './parse-traitors-wiki'
import type { SuggestedEvent, WikiParser } from './types'

export type WikiSourceRow = {
  id: string
  season_id: string | null
  url: string
  parser: WikiParser
  last_snapshot: unknown
  last_revid?: string | null
}

/**
 * Fetches a wiki source, parses it, diffs against the last-seen snapshot,
 * and (if anything changed) queues the matched events for admin review.
 * Never writes to the scoring tables directly — see wiki-sources/actions.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkSource(
  supabase: any,
  source: WikiSourceRow
): Promise<{ changed: boolean; eventCount: number }> {
  if (!source.season_id) return { changed: false, eventCount: 0 }

  const { html, revid } = await fetchWikiPage(source.url)

  // Same wiki revision as last time: nothing was edited, skip all the work.
  if (revid && revid === source.last_revid) {
    await supabase
      .from('show_wiki_sources')
      .update({ last_checked_at: new Date().toISOString(), last_error: null })
      .eq('id', source.id)
    return { changed: false, eventCount: 0 }
  }

  const { data: contestants } = await supabase
    .from('contestants')
    .select('name')
    .eq('season_id', source.season_id)
  const dbNames = (contestants ?? []).map((c: { name: string }) => c.name)

  const { data: latestEpisode } = await supabase
    .from('episodes')
    .select('episode_number')
    .eq('season_id', source.season_id)
    .order('episode_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const finalEpisodeNumber = latestEpisode?.episode_number ?? 1

  let events: SuggestedEvent[]
  let nextSnapshot: BakeoffSnapshot | TraitorsSnapshot

  if (source.parser === 'bakeoff_wiki') {
    const prev = (source.last_snapshot ?? {}) as BakeoffSnapshot
    const next = parseBakeoffWiki(html)
    events = diffBakeoffSnapshots(prev, next, dbNames)
    nextSnapshot = next
  } else {
    const prev = (source.last_snapshot ?? {}) as TraitorsSnapshot
    const next = parseTraitorsWiki(html)
    events = diffTraitorsSnapshots(prev, next, dbNames, finalEpisodeNumber)
    nextSnapshot = next
  }

  const now = new Date().toISOString()
  await supabase
    .from('show_wiki_sources')
    .update({
      last_snapshot: nextSnapshot,
      last_revid: revid,
      last_checked_at: now,
      ...(events.length > 0 ? { last_changed_at: now } : {}),
    })
    .eq('id', source.id)

  if (events.length > 0) {
    await supabase.from('wiki_ingestions').insert({
      source_id: source.id,
      suggested_events: events,
    })
  }

  return { changed: events.length > 0, eventCount: events.length }
}
