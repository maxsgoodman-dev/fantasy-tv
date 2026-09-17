import { createClient } from '@/lib/supabase/server'
import { saveLineup, saveDraft } from './actions'
import { Avatar } from '@/components/avatar'
import { TeamPicker } from '@/components/team-picker'
import { scoreWeeklyLineup } from '@/lib/scoring/weekly-team'

export const dynamic = 'force-dynamic'

function ContestantPhoto({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-24 w-24 rounded-lg object-cover sm:h-32 sm:w-32" />
  }
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-zinc-200 text-center text-xs text-zinc-500 sm:h-32 sm:w-32">
      No photo
    </div>
  )
}

function formatAirDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: league } = await supabase
    .from('leagues')
    .select('name, format, season_id, seasons(shows(id))')
    .eq('id', leagueId)
    .single()

  const showId = (league?.seasons as unknown as { shows: { id: string } } | null)?.shows?.id
  const { count: historySeasonCount } = showId
    ? await supabase
        .from('show_history_seasons')
        .select('id', { count: 'exact', head: true })
        .eq('show_id', showId)
    : { count: 0 }

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, display_name, avatar_url, profiles(display_name, avatar_url)')
    .eq('league_id', leagueId)

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, episode_number, air_date, status')
    .eq('season_id', league!.season_id)
    .order('episode_number')

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name, photo_url')
    .eq('season_id', league!.season_id)
    .order('name')

  if (league?.format === 'weekly_vote') {
    const now = new Date().toISOString()
    const upcomingEpisodes = (episodes ?? []).filter((e) => e.air_date > now)

    const { data: myLineups } = await supabase
      .from('weekly_lineups')
      .select('id, episode_id, weekly_lineup_picks(contestant_id)')
      .eq('league_id', leagueId)
      .eq('user_id', user!.id)

    // Everything needed to compute every member's total score.
    const { data: allLineups } = await supabase
      .from('weekly_lineups')
      .select('user_id, episode_id, weekly_lineup_picks(contestant_id)')
      .eq('league_id', leagueId)

    const { data: allEvents } = await supabase
      .from('contestant_episode_events')
      .select('contestant_id, points, episode_id, episodes!inner(season_id)')
      .eq('episodes.season_id', league.season_id)

    const standingsSource = (members ?? []).map((m) => {
      const memberLineups = (allLineups ?? []).filter((l) => l.user_id === m.user_id)
      const total = memberLineups.reduce((sum, lineup) => {
        const picks = (lineup.weekly_lineup_picks as unknown as { contestant_id: string }[]).map((p) => ({
          contestantId: p.contestant_id,
        }))
        const eventsForEpisode = (allEvents ?? [])
          .filter((e) => e.episode_id === lineup.episode_id)
          .map((e) => ({ contestantId: e.contestant_id, points: e.points }))
        return sum + scoreWeeklyLineup(picks, eventsForEpisode)
      }, 0)
      return { user_id: m.user_id, points_awarded: total }
    })

    return (
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{league?.name}</h1>
          {(historySeasonCount ?? 0) > 0 && (
            <a
              href={`/leagues/${leagueId}/history`}
              className="rounded bg-zinc-700 px-3 py-1.5 text-sm font-semibold text-white"
            >
              League History
            </a>
          )}
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Set your weekly team</h2>
          <p className="text-sm text-zinc-600">
            Pick your team for each upcoming episode. Picks lock when that episode airs — you can change
            your team any time before then, and it can be different every week.
          </p>
          {upcomingEpisodes.length === 0 && (
            <p className="text-zinc-600">No upcoming episodes open for picks right now.</p>
          )}
          {upcomingEpisodes.map((ep) => {
            const myLineup = myLineups?.find((l) => l.episode_id === ep.id)
            const myPickIds = new Set(
              ((myLineup?.weekly_lineup_picks as unknown as { contestant_id: string }[]) ?? []).map(
                (p) => p.contestant_id
              )
            )
            return (
              <form key={ep.id} action={saveLineup.bind(null, leagueId, ep.id)} className="card flex flex-col gap-3 p-4">
                <div>
                  <p className="font-semibold">Episode {ep.episode_number}</p>
                  <p className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                    ⏰ Locks {formatAirDate(ep.air_date)}
                  </p>
                </div>
                <TeamPicker contestants={contestants ?? []} initialSelectedIds={Array.from(myPickIds)} />
                <button
                  type="submit"
                  className="w-fit rounded bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save team
                </button>
              </form>
            )
          })}
        </section>

        <EpisodesSection episodes={episodes} />
        <StandingsSection members={members} standingsSource={standingsSource} currentUserId={user!.id} />
      </div>
    )
  }

  // Season draft format ("bracket"): drafted once, scored from the same
  // kind of stackable per-episode event log as the weekly-team format —
  // just summed across the whole season instead of one episode at a time.
  const draftLockEpisode = episodes?.find((e) => e.episode_number === 2)
  const draftLocked = draftLockEpisode ? draftLockEpisode.air_date <= new Date().toISOString() : false

  const { data: myDraft } = await supabase
    .from('draft_picks')
    .select('contestant_id')
    .eq('league_id', leagueId)
    .eq('user_id', user!.id)

  const { data: eliminationEvents } = await supabase
    .from('episode_events')
    .select('contestant_id')
    .eq('event_type', 'eliminated')
    .in('episode_id', (episodes ?? []).map((e) => e.id))

  const eliminatedContestantIds = new Set((eliminationEvents ?? []).map((e) => e.contestant_id))

  const { data: allSeasonEvents } = await supabase
    .from('contestant_episode_events')
    .select('contestant_id, points, episodes!inner(season_id)')
    .eq('episodes.season_id', league!.season_id)

  const seasonEventPoints = (allSeasonEvents ?? []).map((e) => ({
    contestantId: e.contestant_id,
    points: e.points,
  }))

  const { data: allDraftPicks } = await supabase
    .from('draft_picks')
    .select('user_id, contestant_id')
    .eq('league_id', leagueId)

  const standingsSource = (members ?? []).map((m) => {
    const picks = (allDraftPicks ?? [])
      .filter((p) => p.user_id === m.user_id)
      .map((p) => ({ contestantId: p.contestant_id }))
    return { user_id: m.user_id, points_awarded: scoreWeeklyLineup(picks, seasonEventPoints) }
  })

  const myPickIds = new Set((myDraft ?? []).map((p) => p.contestant_id))

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{league?.name}</h1>
        {(historySeasonCount ?? 0) > 0 && (
          <a
            href={`/leagues/${leagueId}/history`}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm font-semibold text-white"
          >
            League History
          </a>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Your season draft</h2>
        {draftLocked ? (
          <div className="card flex flex-col gap-3 p-4">
            <p className="text-sm text-zinc-600">
              The draft is locked. Here&apos;s how your picks are doing:
            </p>
            <div className="flex flex-wrap gap-3">
              {contestants
                ?.filter((c) => myPickIds.has(c.id))
                .map((c) => {
                  const isOut = eliminatedContestantIds.has(c.id)
                  const points = scoreWeeklyLineup([{ contestantId: c.id }], seasonEventPoints)
                  return (
                    <div key={c.id} className="flex flex-col items-center gap-1 text-sm">
                      <ContestantPhoto url={c.photo_url} name={c.name} />
                      <span>{c.name}</span>
                      <span className={isOut ? 'text-red-600' : 'text-emerald-600'}>
                        {isOut ? 'Eliminated' : 'Still in'}
                      </span>
                      <span className="font-semibold">{points} pts</span>
                    </div>
                  )
                })}
            </div>
          </div>
        ) : (
          <form action={saveDraft.bind(null, leagueId)} className="card flex flex-col gap-3 p-4">
            <p className="text-sm text-zinc-600">
              Pick your team for the season. You can change your picks any time before the draft locks.
            </p>
            <p className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
              ⏰ Locks when Episode 2 airs
              {draftLockEpisode ? ` (${formatAirDate(draftLockEpisode.air_date)})` : ''}
            </p>
            <TeamPicker contestants={contestants ?? []} initialSelectedIds={Array.from(myPickIds)} />
            <button
              type="submit"
              className="w-fit rounded bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Save draft
            </button>
          </form>
        )}
      </section>

      <EpisodesSection episodes={episodes} />
      <StandingsSection members={members} standingsSource={standingsSource} currentUserId={user!.id} />
    </div>
  )
}

function EpisodesSection({
  episodes,
}: {
  episodes: { id: string; episode_number: number; air_date: string; status: string }[] | null
}) {
  return (
    <section className="card p-4">
      <h2 className="text-xl font-bold">Episodes</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {episodes?.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="w-16 font-semibold">Ep. {e.episode_number}</span>
            <span className="text-zinc-600">{formatAirDate(e.air_date)}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                e.status === 'results_posted'
                  ? 'bg-emerald-100 text-emerald-700'
                  : e.status === 'aired'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {e.status.replace('_', ' ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StandingsSection({
  members,
  standingsSource,
  currentUserId,
}: {
  members:
    | {
        user_id: string
        display_name: string | null
        avatar_url: string | null
        profiles: unknown
      }[]
    | null
  standingsSource: { user_id: string; points_awarded: number }[]
  currentUserId: string
}) {
  const standings = (members ?? [])
    .map((m) => {
      const total = standingsSource
        .filter((p) => p.user_id === m.user_id)
        .reduce((sum, p) => sum + p.points_awarded, 0)
      const profile = m.profiles as unknown as { display_name: string; avatar_url: string | null } | null
      return {
        userId: m.user_id,
        name: m.display_name ?? profile?.display_name ?? 'Member',
        avatarUrl: m.avatar_url ?? profile?.avatar_url ?? null,
        total,
      }
    })
    .sort((a, b) => b.total - a.total)

  return (
    <section className="card p-4">
      <h2 className="text-xl font-bold">Standings</h2>
      <ol className="mt-2 flex flex-col gap-2">
        {standings.map((s) => (
          <li
            key={s.userId}
            className={`flex items-center gap-2 ${s.userId === currentUserId ? 'font-bold' : ''}`}
          >
            <Avatar url={s.avatarUrl} name={s.name} size={28} />
            <span>
              {s.name}: {s.total} pts
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
