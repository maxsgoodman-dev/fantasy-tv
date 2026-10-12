'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { checkSource, type WikiSourceRow } from '@/lib/wiki/check-source'
import type { SuggestedEvent } from '@/lib/wiki/types'
import { postScoredEvent, markEliminated } from '@/lib/scoring/post-event'
import { revalidatePath } from 'next/cache'

export async function addSource(formData: FormData) {
  const { supabase } = await requireAdmin()
  await supabase.from('show_wiki_sources').insert({
    show_id: String(formData.get('showId')),
    season_id: String(formData.get('seasonId')),
    url: String(formData.get('url')),
    parser: String(formData.get('parser')),
  })
  revalidatePath('/admin/wiki-sources')
}

export async function toggleSource(sourceId: string, enabled: boolean) {
  const { supabase } = await requireAdmin()
  await supabase.from('show_wiki_sources').update({ enabled }).eq('id', sourceId)
  revalidatePath('/admin/wiki-sources')
}

export async function checkSourceNow(sourceId: string) {
  const { supabase } = await requireAdmin()
  const { data: source } = await supabase
    .from('show_wiki_sources')
    .select('id, season_id, url, parser, last_snapshot, last_revid')
    .eq('id', sourceId)
    .single()
  if (!source) return

  try {
    await checkSource(supabase, source as WikiSourceRow)
    await supabase.from('show_wiki_sources').update({ last_error: null }).eq('id', sourceId)
  } catch (err) {
    await supabase
      .from('show_wiki_sources')
      .update({ last_error: String(err instanceof Error ? err.message : err), last_checked_at: new Date().toISOString() })
      .eq('id', sourceId)
  }

  revalidatePath('/admin/wiki-sources')
}

async function markReviewed(ingestionId: string, eventIndex: number, outcome: 'approved' | 'dismissed') {
  const { supabase } = await requireAdmin()

  const { data: ingestion } = await supabase
    .from('wiki_ingestions')
    .select('suggested_events, reviewed')
    .eq('id', ingestionId)
    .single()
  if (!ingestion) return

  const reviewed: Record<string, string> = {
    ...((ingestion.reviewed ?? {}) as Record<string, string>),
    [eventIndex]: outcome,
  }
  const allReviewed = (ingestion.suggested_events as SuggestedEvent[]).every(
    (_, i) => reviewed[i] !== undefined
  )

  await supabase
    .from('wiki_ingestions')
    .update({ reviewed, status: allReviewed ? 'done' : 'pending' })
    .eq('id', ingestionId)

  revalidatePath('/admin/wiki-sources')
}

export async function approveWikiEvent(ingestionId: string, eventIndex: number, seasonId: string) {
  const { supabase } = await requireAdmin()

  const { data: ingestion } = await supabase
    .from('wiki_ingestions')
    .select('suggested_events, reviewed')
    .eq('id', ingestionId)
    .single()
  if (!ingestion) return

  // Already approved or dismissed (double click, second tab): posting again would double-count.
  if ((ingestion.reviewed as Record<number, string> | null)?.[eventIndex] !== undefined) return

  const event = (ingestion.suggested_events as SuggestedEvent[])[eventIndex]
  if (!event) return

  const { data: contestant } = await supabase
    .from('contestants')
    .select('id')
    .eq('season_id', seasonId)
    .eq('name', event.contestantName)
    .single()
  if (!contestant) return

  const { data: episode } = await supabase
    .from('episodes')
    .select('id')
    .eq('season_id', seasonId)
    .eq('episode_number', event.episodeNumber)
    .single()
  if (!episode) return

  if (event.kind === 'eliminated') {
    await markEliminated(supabase, episode.id, contestant.id, event.label)
  } else {
    await postScoredEvent(supabase, {
      episodeId: episode.id,
      contestantId: contestant.id,
      rule: { code: event.eventCode, label: event.label, points: event.points },
    })
  }

  await markReviewed(ingestionId, eventIndex, 'approved')
}

export async function dismissWikiEvent(ingestionId: string, eventIndex: number) {
  await markReviewed(ingestionId, eventIndex, 'dismissed')
}
