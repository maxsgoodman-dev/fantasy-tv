import { createClient } from '@/lib/supabase/server'
import {
  createShow,
  createSeason,
  updateShow,
  deleteShow,
  updateSeason,
  deleteSeason,
  uploadShowImage,
} from './actions'
import { DeleteButton } from '@/components/delete-button'

export const dynamic = 'force-dynamic'

export default async function ShowsPage() {
  const supabase = await createClient()
  const { data: shows } = await supabase
    .from('shows')
    .select('id, name, description, image_url, theme_color, theme_font, seasons(id, name, year)')
    .order('name')

  return (
    <div className="flex flex-col gap-6">
      <form action={createShow} className="flex gap-2">
        <input name="name" placeholder="Show name" required className="rounded border p-2" />
        <input name="description" placeholder="Description" className="rounded border p-2" />
        <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add show</button>
      </form>

      {shows?.map((show) => (
        <div key={show.id} className="card p-4">
          <div className="flex flex-wrap items-start gap-4">
            {show.image_url ? (
              <img
                src={show.image_url}
                alt={show.name}
                className="h-20 w-32 rounded object-cover"
              />
            ) : (
              <div className="flex h-20 w-32 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-500">
                No image
              </div>
            )}
            <form
              action={async (formData: FormData) => {
                'use server'
                await uploadShowImage(show.id, formData)
              }}
              className="flex flex-col gap-1"
            >
              <input type="file" name="image" accept="image/*" required className="text-xs" />
              <button
                type="submit"
                className="w-fit rounded bg-fuchsia-600 px-2 py-1 text-xs font-semibold text-white"
              >
                Upload show image
              </button>
            </form>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <form
              key={`${show.id}:${show.name}:${show.description}:${show.theme_color}:${show.theme_font}`}
              action={updateShow.bind(null, show.id)}
              className="flex flex-1 flex-wrap items-center gap-2"
            >
              <input
                name="name"
                defaultValue={show.name}
                required
                className="rounded border p-2 font-bold"
              />
              <input
                name="description"
                defaultValue={show.description ?? ''}
                placeholder="Description"
                className="flex-1 rounded border p-2"
              />
              <label className="flex items-center gap-1 text-xs text-zinc-600">
                Accent
                <input
                  type="color"
                  name="themeColor"
                  defaultValue={show.theme_color}
                  className="h-8 w-10 rounded border p-0"
                />
              </label>
              <select
                name="themeFont"
                defaultValue={show.theme_font}
                className="rounded border p-2 text-sm"
              >
                <option value="bold">Bold &amp; dramatic</option>
                <option value="playful">Playful &amp; soft</option>
              </select>
              <button type="submit" className="rounded bg-fuchsia-600 px-3 py-1 text-sm text-white">
                Save
              </button>
            </form>
            <form action={deleteShow.bind(null, show.id)}>
              <DeleteButton
                confirmText={`Delete "${show.name}" and everything under it (seasons, cast, episodes, leagues)?`}
              />
            </form>
          </div>

          <ul className="my-2 flex flex-col gap-2 pl-2">
            {show.seasons?.map((season) => (
              <li key={season.id} className="flex flex-wrap items-center gap-2">
                <a className="underline" href={`/admin/seasons/${season.id}`}>
                  {season.name} {season.year}
                </a>
                <form
                  key={`${season.id}:${season.name}:${season.year}`}
                  action={updateSeason.bind(null, season.id)}
                  className="flex items-center gap-2"
                >
                  <input
                    name="name"
                    defaultValue={season.name}
                    required
                    className="rounded border p-1 text-sm"
                  />
                  <input
                    name="year"
                    type="number"
                    defaultValue={season.year ?? ''}
                    className="w-20 rounded border p-1 text-sm"
                  />
                  <button type="submit" className="rounded bg-fuchsia-600 px-2 py-1 text-xs text-white">
                    Save
                  </button>
                </form>
                <form action={deleteSeason.bind(null, season.id)}>
                  <DeleteButton confirmText={`Delete season "${season.name}" and its cast/episodes/leagues?`} />
                </form>
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
