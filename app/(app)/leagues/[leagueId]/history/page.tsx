import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type EpisodePoint = { episode: number; points: number | null; status: string | null }

function EpisodeCell({ ep }: { ep: EpisodePoint | undefined }) {
  if (!ep) return <td className="px-2 py-1 text-center text-zinc-300">—</td>
  if (ep.status === 'eliminated') {
    return (
      <td className="px-2 py-1 text-center text-xs font-bold text-red-600" title="Eliminated this episode">
        X
      </td>
    )
  }
  if (ep.status === 'out') {
    return <td className="px-2 py-1 text-center text-xs text-zinc-300">–</td>
  }
  return <td className="px-2 py-1 text-center text-sm">{ep.points}</td>
}

export default async function LeagueHistoryPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('name, seasons(shows(id, name))')
    .eq('id', leagueId)
    .single()

  const show = (league?.seasons as unknown as { shows: { id: string; name: string } } | null)?.shows

  const { data: historySeasons } = show
    ? await supabase
        .from('show_history_seasons')
        .select('id, name')
        .eq('show_id', show.id)
        .order('name', { ascending: false })
    : { data: [] as never[] }

  const seasonIds = (historySeasons ?? []).map((s) => s.id)

  const { data: entries } = seasonIds.length
    ? await supabase
        .from('show_history_entries')
        .select('history_season_id, baker_name, team_name, point_total, episode_points')
        .in('history_season_id', seasonIds)
    : { data: [] as never[] }

  const { data: standings } = seasonIds.length
    ? await supabase
        .from('show_history_standings')
        .select('history_season_id, team_name, points, rank')
        .in('history_season_id', seasonIds)
        .order('rank')
    : { data: [] as never[] }

  const maxEpisodes = Math.max(
    1,
    ...(entries ?? []).map((e) => (e.episode_points as EpisodePoint[]).length)
  )

  return (
    <div className="flex flex-col gap-8">
      <a href={`/leagues/${leagueId}`} className="text-sm underline">
        ← {league?.name}
      </a>
      <h1 className="text-2xl font-bold">League History</h1>
      <p className="text-sm text-zinc-600">
        Archived results from past seasons of {show?.name}. This data is read-only — it isn&apos;t
        tracked live by this league.
      </p>

      {(!historySeasons || historySeasons.length === 0) && (
        <p className="text-zinc-600">No archived seasons yet for this show.</p>
      )}

      {historySeasons?.map((season) => {
        const seasonEntries = (entries ?? [])
          .filter((e) => e.history_season_id === season.id)
          .sort((a, b) => b.point_total - a.point_total)
        const seasonStandings = (standings ?? []).filter((s) => s.history_season_id === season.id)

        return (
          <section key={season.id} className="card flex flex-col gap-4 p-4">
            <h2 className="text-xl font-bold">{season.name}</h2>

            {seasonStandings.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
                  Final Team Standings
                </h3>
                <ol className="flex flex-col gap-1">
                  {seasonStandings.map((s) => (
                    <li
                      key={s.team_name}
                      className="flex items-center justify-between rounded bg-zinc-50 px-3 py-1.5 text-sm"
                    >
                      <span className="font-semibold">
                        {s.rank ? `#${s.rank} ` : ''}
                        {s.team_name}
                      </span>
                      <span>{s.points} pts</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="overflow-x-auto">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">Bakers</h3>
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-zinc-500">
                    <th className="px-2 py-1">Baker</th>
                    <th className="px-2 py-1">Team</th>
                    <th className="px-2 py-1 text-center">Total</th>
                    {Array.from({ length: maxEpisodes }, (_, i) => i + 1).map((n) => (
                      <th key={n} className="px-2 py-1 text-center">
                        Ep {n}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seasonEntries.map((entry, idx) => {
                    const episodes = entry.episode_points as EpisodePoint[]
                    return (
                      <tr key={idx} className="border-b border-zinc-100">
                        <td className="px-2 py-1 font-semibold">{entry.baker_name}</td>
                        <td className="px-2 py-1 text-zinc-600">{entry.team_name}</td>
                        <td className="px-2 py-1 text-center font-bold">{entry.point_total}</td>
                        {Array.from({ length: maxEpisodes }, (_, i) => i + 1).map((n) => (
                          <EpisodeCell key={n} ep={episodes.find((e) => e.episode === n)} />
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
