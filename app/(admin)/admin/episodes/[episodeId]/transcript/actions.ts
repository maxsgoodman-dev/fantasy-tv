'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { suggestEventsFromTranscript } from '@/lib/ai/parse-transcript'
import { revalidatePath } from 'next/cache'

export async function uploadTranscript(episodeId: string, formData: FormData) {
  const { supabase, userId } = await requireAdmin()
  const rawText = String(formData.get('rawText'))

  const suggestedEvents = await suggestEventsFromTranscript(rawText)

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

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq(
      'season_id',
      (await supabase.from('episodes').select('season_id').eq('id', episodeId).single()).data!.season_id
    )

  type Suggested = { eventType: string; contestantName: string; description: string }
  const suggestedEvents = (upload!.suggested_events ?? []) as Suggested[]

  for (const suggestion of suggestedEvents) {
    const contestant = contestants?.find(
      (c) => c.name.toLowerCase() === suggestion.contestantName.toLowerCase()
    )
    if (!contestant) continue

    await supabase.from('episode_events').insert({
      episode_id: episodeId,
      event_type: suggestion.eventType,
      contestant_id: contestant.id,
      description: suggestion.description,
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
