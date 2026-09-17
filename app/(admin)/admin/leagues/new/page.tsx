import { createClient } from '@/lib/supabase/server'
import { createLeague } from '../actions'

export const dynamic = 'force-dynamic'

export default async function NewLeaguePage() {
  const supabase = await createClient()
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, shows(name)')
    .order('name')

  return (
    <form
      action={async (formData: FormData) => {
        'use server'
        await createLeague(formData)
      }}
      className="flex max-w-md flex-col gap-4"
    >
      <h1 className="text-2xl font-bold">Create a league</h1>
      <select name="seasonId" required className="rounded border p-2">
        {seasons?.map((s) => (
          <option key={s.id} value={s.id}>
            {(s.shows as unknown as { name: string })?.name} — {s.name}
          </option>
        ))}
      </select>
      <input name="name" placeholder="League name" required className="rounded border p-2" />
      <select name="format" required className="rounded border p-2">
        <option value="weekly_vote">Weekly team (pick a squad each episode, event-based scoring)</option>
        <option value="bracket">Season draft (pick once, survival-based scoring)</option>
      </select>
      <button type="submit" className="rounded bg-fuchsia-600 p-2 font-semibold text-white">
        Create league
      </button>
    </form>
  )
}
