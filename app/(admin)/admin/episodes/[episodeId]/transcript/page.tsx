import { createClient } from '@/lib/supabase/server'
import { uploadTranscript, approveTranscriptUpload } from './actions'

export const dynamic = 'force-dynamic'

export default async function TranscriptPage({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params
  const supabase = await createClient()

  const { data: uploads } = await supabase
    .from('transcript_uploads')
    .select('id, status, suggested_events, created_at')
    .eq('episode_id', episodeId)
    .order('created_at', { ascending: false })

  type Suggested = { eventType: string; contestantName: string; description: string }

  return (
    <div className="flex flex-col gap-6">
      <form action={uploadTranscript.bind(null, episodeId)} className="flex flex-col gap-2">
        <textarea
          name="rawText"
          rows={10}
          placeholder="Paste the licensed episode transcript here"
          required
          className="rounded border p-2"
        />
        <button type="submit" className="w-fit rounded bg-fuchsia-600 px-4 py-2 text-white">
          Parse transcript
        </button>
      </form>

      {uploads?.map((u) => (
        <div key={u.id} className="rounded border p-4">
          <p className="mb-2">Status: {u.status}</p>
          <ul className="list-disc pl-6">
            {((u.suggested_events ?? []) as Suggested[]).map((s, i) => (
              <li key={i}>{s.eventType} — {s.contestantName}: {s.description}</li>
            ))}
          </ul>
          {u.status === 'pending' && (
            <form action={approveTranscriptUpload.bind(null, episodeId, u.id)}>
              <button type="submit" className="mt-2 rounded bg-emerald-600 px-4 py-2 text-white">
                Approve & post results
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  )
}
