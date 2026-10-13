import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LeaguesPage() {
  const supabase = await createClient()
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, name, format, join_code, seasons(name, shows(name))')
    .order('name')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leagues</h1>
        <a
          href="/admin/leagues/new"
          className="rounded bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white"
        >
          + New league
        </a>
      </div>

      {(!leagues || leagues.length === 0) && (
        <p className="text-zinc-600">No leagues yet. Create one to get a join code for members.</p>
      )}

      <ul className="flex flex-col gap-2">
        {leagues?.map((league) => {
          const season = league.seasons as unknown as { name: string; shows: { name: string } } | null
          return (
            <li key={league.id} className="flex flex-wrap items-center gap-3 rounded border p-4">
              <div className="flex-1">
                <div className="font-bold">{league.name}</div>
                <div className="text-sm text-zinc-600">
                  {season?.shows?.name} — {season?.name} ·{' '}
                  {league.format === 'bracket' ? 'Season draft' : 'Weekly team'}
                </div>
              </div>
              <span className="rounded bg-zinc-100 px-2 py-1 font-mono text-sm">{league.join_code}</span>
              <a
                href={`/admin/leagues/${league.id}/settings`}
                className="rounded bg-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700"
              >
                Settings
              </a>
                <a
                  href={`/admin/leagues/${league.id}/teams`}
                  className="rounded bg-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700"
                >
                  Teams
                </a>
              {league.format === 'bracket' && (
                <a
                  href={`/admin/leagues/${league.id}/bracket`}
                  className="rounded bg-zinc-700 px-3 py-1 text-sm font-semibold text-white"
                >
                  Draft board
                </a>
              )}
              <a
                href={`/admin/leagues/${league.id}/questions`}
                className="rounded bg-fuchsia-600 px-3 py-1 text-sm font-semibold text-white"
              >
                Log events
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
