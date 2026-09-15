import { createClient } from '@/lib/supabase/server'
import { addContestant, addEpisode } from '../actions'

export default async function SeasonPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params
  const supabase = await createClient()
  const [{ data: contestants }, { data: episodes }] = await Promise.all([
    supabase.from('contestants').select('id, name').eq('season_id', seasonId).order('name'),
    supabase.from('episodes').select('id, episode_number, air_date, status').eq('season_id', seasonId).order('episode_number'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-xl font-bold">Cast</h2>
        <ul className="list-disc pl-6">
          {contestants?.map((c) => <li key={c.id}>{c.name}</li>)}
        </ul>
        <form action={addContestant.bind(null, seasonId)} className="mt-2 flex gap-2">
          <input name="name" placeholder="Contestant name" required className="rounded border p-2" />
          <input name="bio" placeholder="Bio" className="rounded border p-2" />
          <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add</button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-bold">Episodes</h2>
        <ul className="list-disc pl-6">
          {episodes?.map((e) => (
            <li key={e.id}>
              <a className="underline" href={`/admin/episodes/${e.id}`}>
                Ep. {e.episode_number} — {new Date(e.air_date).toLocaleDateString()} ({e.status})
              </a>
            </li>
          ))}
        </ul>
        <form action={addEpisode.bind(null, seasonId)} className="mt-2 flex gap-2">
          <input name="episodeNumber" type="number" placeholder="#" required className="w-16 rounded border p-2" />
          <input name="airDate" type="datetime-local" required className="rounded border p-2" />
          <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add episode</button>
        </form>
      </section>
    </div>
  )
}
