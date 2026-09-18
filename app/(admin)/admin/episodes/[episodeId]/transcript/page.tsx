import { createClient } from '@/lib/supabase/server'
import { uploadTranscript, approveTranscriptUpload } from './actions'
import { findRuleAcrossSets } from '@/lib/scoring/rulesets'

export const dynamic = 'force-dynamic'

export default async function TranscriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ episodeId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { episodeId } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: uploads } = await supabase
    .from('transcript_uploads')
    .select('id, status, suggested_events, created_at')
    .eq('episode_id', episodeId)
    .order('created_at', { ascending: false })

  type Suggested = { eventCode: string; contestantName: string; description: string }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-zinc-600">
        Claude reads the transcript against this show&apos;s scoring rulebook and suggests events. Approving
        posts them as real scores (and marks anyone knocked out as eliminated).
      </p>
      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Couldn&apos;t parse the transcript: {error}
        </p>
      )}
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
          {((u.suggested_events ?? []) as Suggested[]).length === 0 && (
            <p className="text-sm text-zinc-500">No scoreable events found.</p>
          )}
          <ul className="list-disc pl-6">
            {((u.suggested_events ?? []) as Suggested[]).map((s, i) => (
              <li key={i}>
                <span className="font-semibold">
                  {findRuleAcrossSets(s.eventCode)
                    ? `${findRuleAcrossSets(s.eventCode)!.points > 0 ? '+' : ''}${findRuleAcrossSets(s.eventCode)!.points}`
                    : s.eventCode === 'eliminated'
                      ? 'OUT'
                      : '?'}
                </span>{' '}
                {s.contestantName} — {s.description}{' '}
                <span className="text-xs text-zinc-500">[{s.eventCode}]</span>
              </li>
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
