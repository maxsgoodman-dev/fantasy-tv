export type LeaderboardTeam = {
  id: string
  name: string
  draftSpot: number | null
  members: string[]
}

export type LeaderboardBaker = {
  id: string
  name: string
  teamId: string
  pickOrder: number
  eliminatedEpisode: number | null
  /** episode number -> points, or null when that episode has no results for this baker (shown as "--") */
  perEpisode: Record<number, number | null>
}

// One accent per draft spot (full class names so Tailwind can see them).
const ACCENTS = [
  { chip: 'bg-teal-700', soft: 'bg-teal-500/10', text: 'text-teal-800 dark:text-teal-300', border: 'border-teal-500/40' },
  { chip: 'bg-rose-700', soft: 'bg-rose-500/10', text: 'text-rose-800 dark:text-rose-300', border: 'border-rose-500/40' },
  { chip: 'bg-fuchsia-700', soft: 'bg-fuchsia-500/10', text: 'text-fuchsia-800 dark:text-fuchsia-300', border: 'border-fuchsia-500/40' },
  { chip: 'bg-amber-700', soft: 'bg-amber-500/10', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-500/40' },
]
const accentFor = (i: number) => ACCENTS[i % ACCENTS.length]

function Cell({ value, out }: { value: number | null | 'X'; out?: boolean }) {
  if (value === 'X') return <span className="font-bold text-red-600 dark:text-red-400">X</span>
  if (value === null) return <span className="text-zinc-400">--</span>
  return <span className={out ? 'text-zinc-400' : value > 0 ? 'font-semibold' : 'text-zinc-500'}>{value}</span>
}

/**
 * The season-draft leaderboard, laid out like the league spreadsheet:
 * a standings box (one line per team) and a baker-by-episode table with each baker's team.
 */
export function DraftLeaderboard({
  teams,
  bakers,
  episodeNumbers,
  myTeamId,
}: {
  teams: LeaderboardTeam[]
  bakers: LeaderboardBaker[]
  episodeNumbers: number[]
  myTeamId: string | null
}) {
  const teamIndex = new Map(teams.map((t, i) => [t.id, i]))
  const bakerTotal = (b: LeaderboardBaker) => Object.values(b.perEpisode).reduce<number>((s, v) => s + (v ?? 0), 0)

  const standings = teams
    .map((t) => {
      const mine = bakers.filter((b) => b.teamId === t.id)
      return {
        team: t,
        total: mine.reduce((s, b) => s + bakerTotal(b), 0),
        alive: mine.filter((b) => b.eliminatedEpisode === null).length,
        count: mine.length,
      }
    })
    .sort((a, b) => b.total - a.total || (a.team.draftSpot ?? 99) - (b.team.draftSpot ?? 99))

  const rows = [...bakers].sort(
    (a, b) =>
      (teams.find((t) => t.id === a.teamId)?.draftSpot ?? 99) - (teams.find((t) => t.id === b.teamId)?.draftSpot ?? 99) ||
      a.pickOrder - b.pickOrder
  )

  return (
    <div className="flex flex-col gap-8">
      <section className="card p-4">
        <h2 className="text-xl font-bold">Team standings</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {standings.map((s, i) => {
            const a = accentFor(teamIndex.get(s.team.id) ?? 0)
            return (
              <li
                key={s.team.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${a.soft} ${a.border} ${
                  s.team.id === myTeamId ? 'ring-2 ring-fuchsia-600 dark:ring-fuchsia-400' : ''
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${a.chip}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-bold ${a.text}`}>
                    {s.team.name}
                    {s.team.id === myTeamId && <span className="ml-2 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">(your team)</span>}
                  </div>
                  <div className="truncate text-xs text-zinc-600">
                    {s.alive} of {s.count} bakers still in
                    {s.team.members.length > 0 && ` · ${s.team.members.join(', ')}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold leading-none">{s.total}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">points</div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="card p-4">
        <h2 className="text-xl font-bold">Draft results</h2>
        <p className="text-sm text-zinc-600">
          Every drafted baker, their team, and points by episode. <span className="font-bold text-red-600 dark:text-red-400">X</span> = eliminated
          that episode, <span className="text-zinc-400">--</span> = no points (not scored yet, or already out).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3">Baker</th>
                <th className="py-2 pr-3">Team</th>
                <th className="py-2 pr-3 text-right">Total</th>
                {episodeNumbers.map((n) => (
                  <th key={n} className="px-2 py-2 text-center">
                    Ep {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const t = teams.find((x) => x.id === b.teamId)
                const a = accentFor(teamIndex.get(b.teamId) ?? 0)
                const out = b.eliminatedEpisode !== null
                return (
                  <tr key={b.id} className={`border-b border-zinc-100 ${b.teamId === myTeamId ? 'bg-fuchsia-500/10' : ''}`}>
                    <td className={`py-2 pr-3 font-semibold ${out ? 'text-zinc-500 line-through' : ''}`}>{b.name}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold text-white ${a.chip}`}>
                        {t?.name ?? '—'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-bold">{bakerTotal(b)}</td>
                    {episodeNumbers.map((n) => (
                      <td key={n} className="px-2 py-2 text-center">
                        <Cell
                          value={b.eliminatedEpisode === n ? 'X' : (b.perEpisode[n] ?? null)}
                          out={b.eliminatedEpisode !== null && n > b.eliminatedEpisode}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
