import { createClient } from '@/lib/supabase/server'
import { createShow, createSeason } from './actions'

export default async function ShowsPage() {
  const supabase = await createClient()
  const { data: shows } = await supabase
    .from('shows')
    .select('id, name, seasons(id, name, year)')
    .order('name')

  return (
    <div className="flex flex-col gap-6">
      <form action={createShow} className="flex gap-2">
        <input name="name" placeholder="Show name" required className="rounded border p-2" />
        <input name="description" placeholder="Description" className="rounded border p-2" />
        <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add show</button>
      </form>

      {shows?.map((show) => (
        <div key={show.id} className="rounded border p-4">
          <h2 className="text-xl font-bold">{show.name}</h2>
          <ul className="my-2 list-disc pl-6">
            {show.seasons?.map((season) => (
              <li key={season.id}>
                <a className="underline" href={`/admin/seasons/${season.id}`}>
                  {season.name} {season.year}
                </a>
              </li>
            ))}
          </ul>
          <form action={createSeason.bind(null, show.id)} className="flex gap-2">
            <input name="name" placeholder="Season name" required className="rounded border p-2" />
            <input name="year" type="number" placeholder="Year" className="rounded border p-2" />
            <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add season</button>
          </form>
        </div>
      ))}
    </div>
  )
}
