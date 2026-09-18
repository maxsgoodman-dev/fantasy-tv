import { createClient } from '@/lib/supabase/server'
import { addEpisodeEvent } from '../actions'

export const dynamic = 'force-dynamic'

export default async function EpisodeResultsPage({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params
  const supabase = await createClient()

  const { data: episode } = await supabase
    .from('episodes')
    .select('id, episode_number, season_id, status')
    .eq('id', episodeId)
    .single()

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq('season_id', episode!.season_id)
    .order('name')

  const { data: events } = await supabase
    .from('episode_events')
    .select('id, event_type, description, contestants(name)')
    .eq('episode_id', episodeId)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Episode {episode?.episode_number} results ({episode?.status})</h1>

      <a href={`/admin/episodes/${episodeId}/transcript`} className="w-fit rounded bg-zinc-700 px-3 py-1.5 text-sm font-semibold text-white">
        Score from a transcript
      </a>

      <ul className="list-disc pl-6">
        {events?.map((e) => (
          <li key={e.id}>
            {e.event_type}: {(e.contestants as unknown as { name: string })?.name} — {e.description}
          </li>
        ))}
      </ul>

      <form action={addEpisodeEvent.bind(null, episodeId)} className="flex gap-2">
        <input
          name="eventType"
          defaultValue="eliminated"
          placeholder="Event type (use exactly &quot;eliminated&quot; for elimination results)"
          required
          className="rounded border p-2"
        />
        <select name="contestantId" required className="rounded border p-2">
          {contestants?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input name="description" placeholder="Description" className="rounded border p-2" />
        <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Post result</button>
      </form>
    </div>
  )
}
