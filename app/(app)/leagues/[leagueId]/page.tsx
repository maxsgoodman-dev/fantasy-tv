import { createClient } from '@/lib/supabase/server'
import { saveLineup, saveDraft } from './actions'
import { TeamPicker } from '@/components/team-picker'
import { ShareLeague } from '@/components/share-league'
import { WeeklyLeaderboard, type WeeklyContestant, type WeeklyPlayer } from '@/components/weekly-leaderboard'
import { DraftLeaderboard, type LeaderboardBaker, type LeaderboardTeam } from '@/components/draft-leaderboard'
import { ContestantBios } from '@/components/contestant-bios'
import { ScoringGuide } from '@/components/scoring-guide'
import { scoreWeeklyLineup } from '@/lib/scoring/weekly-team'
import { rulesetForShowName } from '@/lib/scoring/rulesets'
import { effectivePoints, effectiveRules, readOverrides } from '@/lib/scoring/league-rules'

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

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ saveError?: string }>
}) {
  const { leagueId } = await params
  const { saveError } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: league } = await supabase
    .from('leagues')
    .select('name, format, season_id, max_picks, join_code, draft_locks_at, scoring_overrides, seasons(shows(id, name))')
    .eq('id', leagueId)
    .single()

  const show = (league?.seasons as unknown as { shows: { id: string; name: string } } | null)?.shows
  const showId = show?.id
  const overrides = readOverrides(league?.scoring_overrides)
  const maxPicks = league?.max_picks ?? null
  const guide = (
    <ScoringGuide
      rules={effectiveRules(rulesetForShowName(show?.name), overrides)}
      format={league?.format ?? ''}
      maxPicks={maxPicks}
    />
  )
  const { count: historySeasonCount } = showId
    ? await supabase
        .from('show_history_seasons')
        .select('id', { count: 'exact', head: true })
        .eq('show_id', showId)
    : { count: 0 }

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, team_id, display_name, avatar_url, profiles(display_name, avatar_url)')
    .eq('league_id', leagueId)

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, episode_number, air_date, status')
    .eq('season_id', league!.season_id)
    .order('episode_number')

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name, photo_url, age, location, occupation, bio')
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
      .select('contestant_id, points, event_code, episode_id, episodes!inner(season_id)')
      .eq('episodes.season_id', league.season_id)

    const { data: weeklyEliminations } = await supabase
      .from('episode_events')
      .select('contestant_id, episode_id')
      .eq('event_type', 'eliminated')
      .in('episode_id', (episodes ?? []).map((e) => e.id))

    const epNumberById = new Map((episodes ?? []).map((e) => [e.id, e.episode_number]))
    const contestantNameById = new Map((contestants ?? []).map((c) => [c.id, c.name]))
    const scoredEpisodes = new Set<number>()
    const pointsByContestantEp = new Map<string, number>()
    for (const ev of allEvents ?? []) {
      const n = epNumberById.get(ev.episode_id)
      if (n === undefined) continue
      scoredEpisodes.add(n)
      const key = `${ev.contestant_id}:${n}`
      pointsByContestantEp.set(key, (pointsByContestantEp.get(key) ?? 0) + effectivePoints(ev.event_code, ev.points, overrides))
    }
    const shownEpisodeNumbers = Array.from(scoredEpisodes).sort((x, y) => x - y)
    const eliminatedEp = new Map<string, number>()
    for (const ev of weeklyEliminations ?? []) {
      const n = epNumberById.get(ev.episode_id)
      if (n !== undefined) eliminatedEp.set(ev.contestant_id, n)
    }

    const weeklyPlayers: WeeklyPlayer[] = (members ?? []).map((m) => {
      const profile = m.profiles as unknown as { display_name: string; avatar_url: string | null } | null
      const perEpisode: WeeklyPlayer['perEpisode'] = {}
      for (const lineup of (allLineups ?? []).filter((l) => l.user_id === m.user_id)) {
        const n = epNumberById.get(lineup.episode_id)
        if (n === undefined) continue
        const picks = (lineup.weekly_lineup_picks as unknown as { contestant_id: string }[]).map((p) => ({
          contestantId: p.contestant_id,
        }))
        const eventsForEpisode = (allEvents ?? [])
          .filter((e) => e.episode_id === lineup.episode_id)
          .map((e) => ({ contestantId: e.contestant_id, points: effectivePoints(e.event_code, e.points, overrides) }))
        perEpisode[n] = {
          points: scoreWeeklyLineup(picks, eventsForEpisode),
          picks: picks.map((p) => contestantNameById.get(p.contestantId) ?? '?'),
        }
      }
      return {
        userId: m.user_id,
        name: m.display_name ?? profile?.display_name ?? 'Member',
        avatarUrl: m.avatar_url ?? profile?.avatar_url ?? null,
        perEpisode,
      }
    })
    const weeklyContestants: WeeklyContestant[] = (contestants ?? []).map((c) => {
      const elimEp = eliminatedEp.get(c.id) ?? null
      const perEpisode: Record<number, number | null> = {}
      for (const n of shownEpisodeNumbers) {
        perEpisode[n] = elimEp !== null && n > elimEp ? null : (pointsByContestantEp.get(`${c.id}:${n}`) ?? null)
      }
      return { id: c.id, name: c.name, eliminatedEpisode: elimEp, perEpisode }
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

        {league?.join_code && <ShareLeague leagueName={league.name} joinCode={league.join_code} />}
        {saveError && (
          <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            Your picks weren&apos;t saved: {saveError}
          </p>
        )}

        <WeeklyLeaderboard
          players={weeklyPlayers}
          contestants={weeklyContestants}
          episodeNumbers={shownEpisodeNumbers}
          currentUserId={user!.id}
        />

        <ContestantBios contestants={contestants ?? []} />

        {guide}

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
                <TeamPicker contestants={contestants ?? []} initialSelectedIds={Array.from(myPickIds)} maxPicks={maxPicks} />
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
      </div>
    )
  }

  // Season draft format ("bracket"): drafted once, scored from the same
  // kind of stackable per-episode event log as the weekly-team format —
  // just summed across the whole season instead of one episode at a time.
  const draftLockEpisode = episodes?.find((e) => e.episode_number === 2)
  const draftLockAt = league?.draft_locks_at ?? draftLockEpisode?.air_date ?? null
  const draftLocked = draftLockAt ? draftLockAt <= new Date().toISOString() : false

  const { data: leagueTeams } = await supabase
    .from('league_teams')
    .select('id, name, draft_spot')
    .eq('league_id', leagueId)
    .order('draft_spot', { ascending: true, nullsFirst: false })
  const teamMode = (leagueTeams ?? []).length > 0
  const draftGuide = teamMode ? (
    <ScoringGuide
      rules={effectiveRules(rulesetForShowName(show?.name), overrides)}
      format={league?.format ?? ''}
      maxPicks={maxPicks}
      teamDraft
    />
  ) : (
    guide
  )
  const myMembership = (members ?? []).find((m) => m.user_id === user!.id)
  const myTeamId: string | null = (myMembership?.team_id as string | null | undefined) ?? null

  const { data: allDraftPicks } = await supabase
    .from('draft_picks')
    .select('user_id, team_id, contestant_id, created_at')
    .eq('league_id', leagueId)
    .order('created_at')

  // A team's picks are shared by everyone on the team; a teamless member has their own.
  const isMine = (p: { user_id: string | null; team_id: string | null }) =>
    teamMode && myTeamId ? p.team_id === myTeamId : p.team_id === null && p.user_id === user!.id
  const myDraft = (allDraftPicks ?? []).filter(isMine)

  const { data: eliminationEvents } = await supabase
    .from('episode_events')
    .select('contestant_id, episode_id')
    .eq('event_type', 'eliminated')
    .in('episode_id', (episodes ?? []).map((e) => e.id))

  const eliminatedContestantIds = new Set((eliminationEvents ?? []).map((e) => e.contestant_id))

  const { data: allSeasonEvents } = await supabase
    .from('contestant_episode_events')
    .select('contestant_id, points, event_code, episode_id, episodes!inner(season_id)')
    .eq('episodes.season_id', league!.season_id)

  const seasonEventPoints = (allSeasonEvents ?? []).map((e) => ({
    contestantId: e.contestant_id,
    points: effectivePoints(e.event_code, e.points, overrides),
  }))

  // Team leaderboard data (spreadsheet-style: baker x episode, plus a team standings box).
  const epNumberById = new Map((episodes ?? []).map((e) => [e.id, e.episode_number]))
  const eliminatedEpByContestant = new Map<string, number>()
  for (const ev of eliminationEvents ?? []) {
    const n = epNumberById.get(ev.episode_id)
    if (n !== undefined) eliminatedEpByContestant.set(ev.contestant_id, n)
  }
  const scoredEpisodeNumbers = new Set<number>()
  const pointsByBakerEp = new Map<string, number>()
  for (const ev of allSeasonEvents ?? []) {
    const n = epNumberById.get(ev.episode_id)
    if (n === undefined) continue
    scoredEpisodeNumbers.add(n)
    const key = `${ev.contestant_id}:${n}`
    pointsByBakerEp.set(key, (pointsByBakerEp.get(key) ?? 0) + effectivePoints(ev.event_code, ev.points, overrides))
  }
  // Show the episodes that have results, plus the next one (at least three columns).
  const maxScoredEpisode = Math.max(0, ...Array.from(scoredEpisodeNumbers))
  const episodeNumbers = (episodes ?? [])
    .map((e) => e.episode_number)
    .filter((n) => n <= Math.max(maxScoredEpisode + 1, 3))
  const contestantNameById = new Map((contestants ?? []).map((c) => [c.id, c.name]))

  // Leagues without teams: every member is a one-person team, so everyone gets the same leaderboard.
  const lbTeams: LeaderboardTeam[] = teamMode
    ? (leagueTeams ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        draftSpot: t.draft_spot,
        members: (members ?? [])
          .filter((m) => m.team_id === t.id)
          .map((m) => {
            const profile = m.profiles as unknown as { display_name: string } | null
            return m.display_name ?? profile?.display_name ?? 'Member'
          }),
      }))
    : (members ?? []).map((m, i) => {
        const profile = m.profiles as unknown as { display_name: string } | null
        return { id: m.user_id, name: m.display_name ?? profile?.display_name ?? 'Member', draftSpot: i + 1, members: [] }
      })
  const lbBakers: LeaderboardBaker[] = (allDraftPicks ?? [])
    .filter((p) => (teamMode ? p.team_id : p.team_id === null && p.user_id))
    .map((p, i) => {
      const elimEp = eliminatedEpByContestant.get(p.contestant_id) ?? null
      const perEpisode: Record<number, number | null> = {}
      for (const n of episodeNumbers) {
        perEpisode[n] =
          elimEp !== null && n > elimEp ? null : scoredEpisodeNumbers.has(n) ? (pointsByBakerEp.get(`${p.contestant_id}:${n}`) ?? 0) : null
      }
      return {
        id: p.contestant_id,
        name: contestantNameById.get(p.contestant_id) ?? 'Unknown',
        teamId: (teamMode ? p.team_id : p.user_id) as string,
        pickOrder: i,
        eliminatedEpisode: elimEp,
        perEpisode,
      }
    })

  const myPickIds = new Set(myDraft.map((p) => p.contestant_id))

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

      {league?.join_code && <ShareLeague leagueName={league.name} joinCode={league.join_code} />}
      {saveError && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Your picks weren&apos;t saved: {saveError}
        </p>
      )}

      <DraftLeaderboard
        teams={lbTeams}
        bakers={lbBakers}
        episodeNumbers={episodeNumbers}
        myTeamId={teamMode ? myTeamId : user!.id}
        individual={!teamMode}
      />

      <ContestantBios contestants={contestants ?? []} />

        {draftGuide}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{teamMode ? 'Your team’s draft' : 'Your season draft'}</h2>
        {teamMode && !myTeamId ? (
          <p className="card p-4 text-sm text-zinc-600">
            You&apos;re in this league but not on a team yet. Ask the league organizer to add your email to your team.
          </p>
        ) : draftLocked ? (
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
              {league?.draft_locks_at
                ? `⏰ Draft locks ${new Date(league.draft_locks_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })}`
                : `⏰ Locks when Episode 2 airs${draftLockEpisode ? ` (${formatAirDate(draftLockEpisode.air_date)})` : ''}`}
            </p>
            <TeamPicker
              contestants={contestants ?? []}
              initialSelectedIds={Array.from(myPickIds)}
              maxPicks={maxPicks}
              takenIds={(allDraftPicks ?? []).filter((p) => !isMine(p)).map((p) => p.contestant_id)}
              eliminatedIds={Array.from(eliminatedContestantIds)}
            />
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
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : e.status === 'aired'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-zinc-500/15 text-zinc-600'
              }`}
            >
              {e.status === 'upcoming' ? 'upcoming' : e.status === 'aired' ? 'aired' : 'results in'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
