import { createClient } from '@/lib/supabase/server'
import {
  addContestant,
  addEpisode,
  updateContestant,
  deleteContestant,
  updateEpisode,
  deleteEpisode,
} from '../actions'
import { DeleteButton } from '@/components/delete-button'

export const dynamic = 'force-dynamic'

export default async function SeasonPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params
  const supabase = await createClient()
  const { data: season } = await supabase
    .from('seasons')
    .select('name, year, shows(name)')
    .eq('id', seasonId)
    .single()
  const [{ data: contestants }, { data: episodes }] = await Promise.all([
    supabase.from('contestants').select('id, name, bio').eq('season_id', seasonId).order('name'),
    supabase
      .from('episodes')
      .select('id, episode_number, air_date, status')
      .eq('season_id', seasonId)
      .order('episode_number'),
  ])

  const show = season?.shows as unknown as { name: string } | null

  return (
    <div className="flex flex-col gap-6">
      <a href="/admin/shows" className="text-sm underline">
        ← Shows
      </a>
      <h1 className="text-2xl font-bold">
        {show?.name} — {season?.name} {season?.year}
      </h1>
      <section>
        <h2 className="text-xl font-bold">Cast</h2>
        <ul className="my-2 flex flex-col gap-2">
          {contestants?.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <form
                key={`${c.id}:${c.name}:${c.bio}`}
                action={updateContestant.bind(null, c.id, seasonId)}
                className="flex flex-1 flex-wrap items-center gap-2"
              >
                <input name="name" defaultValue={c.name} required className="rounded border p-1 text-sm" />
                <input
                  name="bio"
                  defaultValue={c.bio ?? ''}
                  placeholder="Bio"
                  className="flex-1 rounded border p-1 text-sm"
                />
                <button type="submit" className="rounded bg-fuchsia-600 px-2 py-1 text-xs text-white">
                  Save
                </button>
              </form>
              <form action={deleteContestant.bind(null, c.id, seasonId)}>
                <DeleteButton confirmText={`Remove contestant "${c.name}"?`} />
              </form>
            </li>
          ))}
        </ul>
        <form action={addContestant.bind(null, seasonId)} className="mt-2 flex gap-2">
          <input name="name" placeholder="Contestant name" required className="rounded border p-2" />
          <input name="bio" placeholder="Bio" className="rounded border p-2" />
          <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add</button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-bold">Episodes</h2>
        <ul className="my-2 flex flex-col gap-2">
          {episodes?.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <a className="underline" href={`/admin/episodes/${e.id}`}>
                ({e.status})
              </a>
              <form
                key={`${e.id}:${e.episode_number}:${e.air_date}`}
                action={updateEpisode.bind(null, e.id, seasonId)}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  name="episodeNumber"
                  type="number"
                  defaultValue={e.episode_number}
                  required
                  className="w-16 rounded border p-1 text-sm"
                />
                <input
                  name="airDate"
                  type="datetime-local"
                  defaultValue={new Date(e.air_date).toISOString().slice(0, 16)}
                  required
                  className="rounded border p-1 text-sm"
                />
                <button type="submit" className="rounded bg-fuchsia-600 px-2 py-1 text-xs text-white">
                  Save
                </button>
              </form>
              <form action={deleteEpisode.bind(null, e.id, seasonId)}>
                <DeleteButton confirmText={`Delete episode ${e.episode_number}?`} />
              </form>
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
