import { Avatar } from '@/components/avatar'

export type WeeklyPlayer = {
  id: string
  name: string
  avatarUrl: string | null
  /** e.g. the people on a shared team */
  subtitle?: string
  /** episode number -> { points, picks }, or undefined when the player had no lineup that week */
  perEpisode: Record<number, { points: number; picks: string[] } | undefined>
}

export type WeeklyContestant = {
  id: string
  name: string
  eliminatedEpisode: number | null
  /** episode number -> points, or null when nothing was scored for them (shown as "--") */
  perEpisode: Record<number, number | null>
}

function PointsCell({ value, out }: { value: number | 'X' | null; out?: boolean }) {
  if (value === 'X') return <span className="font-bold text-red-600 dark:text-red-400">X</span>
  if (value === null) return <span className="text-zinc-400">--</span>
  return <span className={out ? 'text-zinc-400' : value > 0 ? 'font-semibold' : value < 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-zinc-500'}>{value}</span>
}

const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0)

/**
 * Leaderboard for weekly-lineup leagues, laid out like the league spreadsheet: a ranked standings
 * box, a player-by-episode table (with the picks behind each score), and a contestant-by-episode table
 * showing who is still in. Show-agnostic: it only knows players, contestants, episodes and points.
 */
export function WeeklyLeaderboard({
  players,
  contestants,
  episodeNumbers,
  myId,
}: {
  players: WeeklyPlayer[]
  contestants: WeeklyContestant[]
  episodeNumbers: number[]
  /** the signed-in user's player/team id, to highlight their row */
  myId: string | null
}) {
  const totalOf = (p: WeeklyPlayer) => sum(Object.values(p.perEpisode).map((v) => v?.points))
  const ranked = [...players].sort((a, b) => totalOf(b) - totalOf(a) || a.name.localeCompare(b.name))
  const contestantTotal = (c: WeeklyContestant) => sum(Object.values(c.perEpisode))
  const contestantRows = [...contestants].sort((a, b) => {
    const ao = a.eliminatedEpisode !== null ? 1 : 0
    const bo = b.eliminatedEpisode !== null ? 1 : 0
    return ao - bo || contestantTotal(b) - contestantTotal(a) || a.name.localeCompare(b.name)
  })
  const stillIn = contestants.filter((c) => c.eliminatedEpisode === null).length

  return (
    <div className="flex flex-col gap-8">
      <section className="card p-4">
        <h2 className="text-xl font-bold">Standings</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {ranked.map((p, i) => {
            const mine = p.id === myId
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  mine ? 'border-fuchsia-500/40 bg-fuchsia-500/10 ring-2 ring-fuchsia-600 dark:ring-fuchsia-400' : 'border-zinc-500/30 bg-zinc-500/5'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-white">
                  {i + 1}
                </span>
                {p.avatarUrl !== null && <Avatar url={p.avatarUrl} name={p.name} size={28} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">
                    {p.name}
                    {mine && <span className="ml-2 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">(you)</span>}
                  </div>
                  {p.subtitle && <div className="truncate text-xs text-zinc-600">{p.subtitle}</div>}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold leading-none">{totalOf(p)}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">points</div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {episodeNumbers.length > 0 && (
        <section className="card p-4">
          <h2 className="text-xl font-bold">Scores by episode</h2>
          <p className="text-sm text-zinc-600">
            Points each player&apos;s weekly team earned, with the team that week underneath. <span className="text-zinc-400">--</span> = no team
            set.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  {episodeNumbers.map((n) => (
                    <th key={n} className="px-2 py-2 text-center">
                      Ep {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr key={p.id} className={`border-b border-zinc-100 align-top ${p.id === myId ? 'bg-fuchsia-500/10' : ''}`}>
                    <td className="py-2 pr-3 font-semibold">{p.name}</td>
                    <td className="py-2 pr-3 text-right font-bold">{totalOf(p)}</td>
                    {episodeNumbers.map((n) => {
                      const cell = p.perEpisode[n]
                      return (
                        <td key={n} className="px-2 py-2 text-center" title={cell?.picks.join(', ')}>
                          <PointsCell value={cell ? cell.points : null} />
                          {cell && cell.picks.length > 0 && (
                            <div className="mx-auto mt-0.5 max-w-[7rem] text-[10px] leading-tight text-zinc-500">
                              {cell.picks.map((n2) => n2.split(' ')[0]).join(', ')}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {episodeNumbers.length > 0 && (
        <section className="card p-4">
          <h2 className="text-xl font-bold">Contestants</h2>
          <p className="text-sm text-zinc-600">
            {stillIn} of {contestants.length} still in. Points each contestant has earned by episode.{' '}
            <span className="font-bold text-red-600 dark:text-red-400">X</span> = out that episode (points shown first).
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Contestant</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  {episodeNumbers.map((n) => (
                    <th key={n} className="px-2 py-2 text-center">
                      Ep {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contestantRows.map((c) => {
                  const out = c.eliminatedEpisode !== null
                  return (
                    <tr key={c.id} className="border-b border-zinc-100">
                      <td className={`py-2 pr-3 font-semibold ${out ? 'text-zinc-500 line-through' : ''}`}>{c.name}</td>
                      <td className="py-2 pr-3 text-right font-bold">{contestantTotal(c)}</td>
                      {episodeNumbers.map((n) => (
                        <td key={n} className="px-2 py-2 text-center">
                          {c.eliminatedEpisode === n ? (
                            <span className="font-bold text-red-600 dark:text-red-400">
                              {c.perEpisode[n] ?? 0} X
                            </span>
                          ) : (
                            <PointsCell
                              value={c.perEpisode[n] ?? null}
                              out={out && n > (c.eliminatedEpisode as number)}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
