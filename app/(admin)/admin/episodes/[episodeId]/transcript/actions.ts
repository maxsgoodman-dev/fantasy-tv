'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { suggestEventsFromTranscript, ELIMINATED_CODE, type SuggestedEvent } from '@/lib/ai/parse-transcript'
import { rulesetForShowName, findRuleAcrossSets } from '@/lib/scoring/rulesets'
import { postScoredEvent, markEliminated, rollbackInserted, type InsertedRow } from '@/lib/scoring/post-event'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function loadEpisodeContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  episodeId: string
) {
  const { data: episode } = await supabase
    .from('episodes')
    .select('season_id, seasons(shows(name))')
    .eq('id', episodeId)
    .single()

  const showName = (episode?.seasons as { shows: { name: string } } | null)?.shows?.name
  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq('season_id', episode!.season_id)

  return {
    rules: rulesetForShowName(showName),
    contestants: (contestants ?? []) as { id: string; name: string }[],
  }
}

/** Transcripts use full names or first names; DB names may be either. */
function matchContestant(contestants: { id: string; name: string }[], name: string) {
  const target = name.trim().toLowerCase()
  return (
    contestants.find((c) => c.name.toLowerCase() === target) ??
    contestants.find((c) => c.name.toLowerCase().split(/\s+/)[0] === target.split(/\s+/)[0])
  )
}

export async function uploadTranscript(episodeId: string, formData: FormData) {
  const { supabase, userId } = await requireAdmin()
  const rawText = String(formData.get('rawText'))

  const { rules, contestants } = await loadEpisodeContext(supabase, episodeId)
  let suggestedEvents: SuggestedEvent[]
  try {
    suggestedEvents = await suggestEventsFromTranscript(
      rawText,
      rules,
      contestants.map((c) => c.name)
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    redirect(`/admin/episodes/${episodeId}/transcript?error=${encodeURIComponent(message.slice(0, 300))}`)
  }

  await supabase.from('transcript_uploads').insert({
    episode_id: episodeId,
    raw_text: rawText,
    suggested_events: suggestedEvents,
    uploaded_by: userId,
  })

  revalidatePath(`/admin/episodes/${episodeId}/transcript`)
}

export async function approveTranscriptUpload(episodeId: string, uploadId: string) {
  const { supabase, userId } = await requireAdmin()
  const errorUrl = (message: string) =>
    `/admin/episodes/${episodeId}/transcript?error=${encodeURIComponent(message.slice(0, 300))}`

  // Claim the upload atomically (pending -> approved) BEFORE posting anything. A double
  // click, a second tab or a retry then finds nothing to claim instead of re-posting
  // every event and double-counting the points.
  const { data: claimed } = await supabase
    .from('transcript_uploads')
    .update({ status: 'approved', reviewed_by: userId })
    .eq('id', uploadId)
    .eq('status', 'pending')
    .select('suggested_events')
  if (!claimed || claimed.length === 0) {
    redirect(errorUrl('This transcript was already approved, so nothing was posted again.'))
  }

  const { contestants } = await loadEpisodeContext(supabase, episodeId)
  const suggestedEvents = (claimed[0].suggested_events ?? []) as SuggestedEvent[]

  const inserted: InsertedRow[] = []
  let failure: string | null = null
  try {
    for (const suggestion of suggestedEvents) {
      const contestant = matchContestant(contestants, suggestion.contestantName)
      if (!contestant) continue

      if (suggestion.eventCode === ELIMINATED_CODE) {
        const markerId = await markEliminated(supabase, episodeId, contestant.id, suggestion.description)
        if (markerId) inserted.push({ table: 'episode_events', id: markerId })
        continue
      }

      const rule = findRuleAcrossSets(suggestion.eventCode)
      if (!rule) continue

      inserted.push(
        ...(await postScoredEvent(supabase, {
          episodeId,
          contestantId: contestant.id,
          rule,
          label: suggestion.description,
        }))
      )
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err)
  }

  if (failure) {
    // Undo what this run wrote and put the upload back to pending so it can be retried cleanly.
    await rollbackInserted(supabase, inserted)
    await supabase.from('transcript_uploads').update({ status: 'pending', reviewed_by: null }).eq('id', uploadId)
    redirect(errorUrl(`Nothing was posted. ${failure}`))
  }

  await supabase.from('episodes').update({ status: 'results_posted' }).eq('id', episodeId)

  revalidatePath(`/admin/episodes/${episodeId}`)
  revalidatePath(`/admin/episodes/${episodeId}/transcript`)
}
