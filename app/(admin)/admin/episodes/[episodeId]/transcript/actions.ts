'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { suggestEventsFromTranscript, ELIMINATED_CODE, type SuggestedEvent } from '@/lib/ai/parse-transcript'
import { rulesetForShowName, findRuleAcrossSets } from '@/lib/scoring/rulesets'
import { postScoredEvent, markEliminated } from '@/lib/scoring/post-event'
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

  const { data: upload } = await supabase
    .from('transcript_uploads')
    .select('suggested_events')
    .eq('id', uploadId)
    .single()

  const { contestants } = await loadEpisodeContext(supabase, episodeId)
  const suggestedEvents = (upload!.suggested_events ?? []) as SuggestedEvent[]

  for (const suggestion of suggestedEvents) {
    const contestant = matchContestant(contestants, suggestion.contestantName)
    if (!contestant) continue

    if (suggestion.eventCode === ELIMINATED_CODE) {
      await markEliminated(supabase, episodeId, contestant.id, suggestion.description)
      continue
    }

    const rule = findRuleAcrossSets(suggestion.eventCode)
    if (!rule) continue

    await postScoredEvent(supabase, {
      episodeId,
      contestantId: contestant.id,
      rule,
      label: suggestion.description,
    })
  }

  await supabase
    .from('transcript_uploads')
    .update({ status: 'approved', reviewed_by: userId })
    .eq('id', uploadId)

  await supabase.from('episodes').update({ status: 'results_posted' }).eq('id', episodeId)

  revalidatePath(`/admin/episodes/${episodeId}`)
  revalidatePath(`/admin/episodes/${episodeId}/transcript`)
}
