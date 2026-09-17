import { createClient } from '@/lib/supabase/server'
import { logContestantEvent, deleteContestantEvent } from './actions'
import { DeleteButton } from '@/components/delete-button'
import { rulesetForShowName } from '@/lib/scoring/rulesets'

export const dynamic = 'force-dynamic'

export default async function LeagueEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ episodeId?: string }>
}) {
  const { leagueId } = await params
  const { episodeId: episodeIdParam } = await searchParams
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('name, season_id, join_code, seasons(shows(name))')
    .eq('id', leagueId)
    .single()

  const showName = (league?.seasons as unknown as { shows: { name: string } } | null)?.shows?.name
  const rules = rulesetForShowName(showName)

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, episode_number, air_date')
    .eq('season_id', league!.season_id)
    .order('episode_number')

  const episodeId = episodeIdParam ?? episodes?.[0]?.id
  const currentEpisode = episodes?.find((e) => e.id === episodeId)

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq('season_id', league!.season_id)
    .order('name')

  const { data: loggedEvents } = episodeId
    ? await supabase
        .from('contestant_episode_events')
        .select('id, event_code, label, points, contestants(name)')
        .eq('episode_id', episodeId)
        .order('created_at', { ascending: false })
    : { data: [] as never[] }

  return (
    <div className="flex flex-col gap-6">
      <a href="/admin/leagues" className="text-sm underline">
        ← Leagues
      </a>
      <h1 className="text-2xl font-bold">{league?.name}</h1>
      <p>
        Join code: <span className="font-mono">{league?.join_code}</span>
      </p>

      <div className="flex flex-wrap gap-2">
        {episodes?.map((e) => (
          <a
            key={e.id}
            href={`/admin/leagues/${leagueId}/questions?episodeId=${e.id}`}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              e.id === episodeId ? 'bg-fuchsia-600 text-white' : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            Ep. {e.episode_number}
          </a>
        ))}
      </div>

      {currentEpisode && (
        <div className="card flex flex-col gap-4 p-4">
          <h2 className="text-xl font-bold">
            Log events — Episode {currentEpisode.episode_number}
          </h2>

          <form
            action={logContestantEvent.bind(null, leagueId, currentEpisode.id)}
            className="flex flex-wrap gap-2"
          >
            <select name="contestantId" required className="rounded border p-2">
              {contestants?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select name="eventCode" required className="flex-1 rounded border p-2">
              {rules.map((rule) => (
                <option key={rule.code} value={rule.code}>
                  [{rule.category}] {rule.label} ({rule.points > 0 ? '+' : ''}
                  {rule.points})
                </option>
              ))}
            </select>
            <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">
              Log event
            </button>
          </form>

          <ul className="flex flex-col gap-1">
            {loggedEvents?.map((ev) => {
              const contestant = ev.contestants as unknown as { name: string } | null
              return (
                <li key={ev.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      ev.points >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {ev.points > 0 ? '+' : ''}
                    {ev.points}
                  </span>
                  <span className="font-semibold">{contestant?.name}</span>
                  <span className="text-zinc-600">{ev.label}</span>
                  <form action={deleteContestantEvent.bind(null, leagueId, ev.id)}>
                    <DeleteButton confirmText="Remove this logged event?" label="×" />
                  </form>
                </li>
              )
            })}
            {loggedEvents?.length === 0 && (
              <li className="text-sm text-zinc-500">No events logged for this episode yet.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
