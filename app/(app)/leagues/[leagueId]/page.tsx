import { createClient } from '@/lib/supabase/server'
import { submitPick, submitBracketPick } from './actions'

export const dynamic = 'force-dynamic'

function ContestantPhoto({ url, name, size = 64 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-lg object-cover"
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-lg bg-zinc-200 text-center text-xs text-zinc-500"
    >
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
    .select('name, format, season_id')
    .eq('id', leagueId)
    .single()

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, profiles(display_name)')
    .eq('league_id', leagueId)

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, episode_number, air_date, status')
    .eq('season_id', league!.season_id)
    .order('episode_number')

  let standingsSource: { user_id: string; points_awarded: number }[] = []

  if (league?.format === 'weekly_vote') {
    const { data: openQuestions } = await supabase
      .from('weekly_questions')
      .select('id, question_text, lock_at, episodes(episode_number)')
      .eq('league_id', leagueId)
      .is('resolved_at', null)
      .gt('lock_at', new Date().toISOString())

    const { data: contestants } = await supabase
      .from('contestants')
      .select('id, name, photo_url')
      .eq('season_id', league!.season_id)
      .order('name')

    const { data: myPicks } = await supabase
      .from('member_picks')
      .select('weekly_question_id, picked_contestant_id')
      .eq('user_id', user!.id)

    const { data: allPicks } = await supabase
      .from('member_picks')
      .select('user_id, points_awarded, weekly_questions!inner(league_id)')
      .eq('weekly_questions.league_id', leagueId)

    standingsSource = allPicks ?? []

    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-bold">{league?.name}</h1>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">This week&apos;s picks</h2>
          {openQuestions?.length === 0 && (
            <p className="text-zinc-600">No open questions right now — check back once the admin adds one.</p>
          )}
          {openQuestions?.map((q) => {
            const episode = q.episodes as unknown as { episode_number: number } | null
            const myPick = myPicks?.find((p) => p.weekly_question_id === q.id)?.picked_contestant_id
            return (
              <div key={q.id} className="flex flex-col gap-3 rounded border p-4">
                <div>
                  <p className="font-semibold">
                    {episode ? `Episode ${episode.episode_number}: ` : ''}
                    {q.question_text}
                  </p>
                  <p className="text-xs text-zinc-500">Locks {formatAirDate(q.lock_at)}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {contestants?.map((c) => (
                    <form key={c.id} action={submitPick.bind(null, leagueId, q.id, c.id)}>
                      <button
                        type="submit"
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-xs ${
                          myPick === c.id ? 'border-fuchsia-600 bg-fuchsia-50' : 'border-transparent'
                        }`}
                      >
                        <ContestantPhoto url={c.photo_url} name={c.name} />
                        <span>{c.name}</span>
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )
          })}
        </section>

        <EpisodesSection episodes={episodes} />
        <StandingsSection members={members} standingsSource={standingsSource} currentUserId={user!.id} />
      </div>
    )
  }

  // Bracket format
  const { data: matchups } = await supabase
    .from('bracket_matchups')
    .select(
      'id, round, matchup_index, winner_id, contestant_a:contestants!contestant_a_id(id, name, photo_url), contestant_b:contestants!contestant_b_id(id, name, photo_url)'
    )
    .eq('league_id', leagueId)
    .order('round')
    .order('matchup_index')

  const { data: myBracketPicks } = await supabase
    .from('member_bracket_picks')
    .select('matchup_id, predicted_winner_id')
    .eq('user_id', user!.id)

  const { data: allBracketPicks } = await supabase
    .from('member_bracket_picks')
    .select('user_id, points_awarded, bracket_matchups!inner(league_id)')
    .eq('bracket_matchups.league_id', leagueId)

  standingsSource = allBracketPicks ?? []

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">{league?.name}</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Bracket</h2>
        {matchups?.length === 0 && (
          <p className="text-zinc-600">The bracket hasn&apos;t been seeded yet — check back once the admin sets it up.</p>
        )}
        {matchups?.map((m) => {
          const a = m.contestant_a as unknown as { id: string; name: string; photo_url: string | null } | null
          const b = m.contestant_b as unknown as { id: string; name: string; photo_url: string | null } | null
          const myPick = myBracketPicks?.find((p) => p.matchup_id === m.id)?.predicted_winner_id
          return (
            <div key={m.id} className="flex flex-col gap-2 rounded border p-4">
              <p className="text-xs font-semibold text-zinc-500">
                Round {m.round}, Match {m.matchup_index + 1}
              </p>
              <div className="flex items-center gap-4">
                {[a, b].map((c, i) =>
                  c ? (
                    <form key={c.id} action={submitBracketPick.bind(null, leagueId, m.id, c.id)}>
                      <button
                        type="submit"
                        disabled={!!m.winner_id}
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-xs ${
                          myPick === c.id ? 'border-fuchsia-600 bg-fuchsia-50' : 'border-transparent'
                        } ${m.winner_id === c.id ? 'ring-2 ring-emerald-500' : ''}`}
                      >
                        <ContestantPhoto url={c.photo_url} name={c.name} />
                        <span>{c.name}</span>
                      </button>
                    </form>
                  ) : (
                    <div key={`tbd-${i}`} className="text-sm text-zinc-400">
                      TBD
                    </div>
                  )
                )}
              </div>
              {m.winner_id && <p className="text-xs font-semibold text-emerald-600">Winner decided</p>}
            </div>
          )
        })}
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
    <section>
      <h2 className="text-xl font-bold">Episodes</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {episodes?.map((e) => (
          <li key={e.id} className="flex items-center gap-3 text-sm">
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
  members: { user_id: string; profiles: unknown }[] | null
  standingsSource: { user_id: string; points_awarded: number }[]
  currentUserId: string
}) {
  const standings = (members ?? [])
    .map((m) => {
      const total = standingsSource
        .filter((p) => p.user_id === m.user_id)
        .reduce((sum, p) => sum + p.points_awarded, 0)
      return {
        userId: m.user_id,
        name: (m.profiles as unknown as { display_name: string })?.display_name,
        total,
      }
    })
    .sort((a, b) => b.total - a.total)

  return (
    <section>
      <h2 className="text-xl font-bold">Standings</h2>
      <ol className="list-decimal pl-6">
        {standings.map((s) => (
          <li key={s.userId} className={s.userId === currentUserId ? 'font-bold' : ''}>
            {s.name}: {s.total} pts
          </li>
        ))}
      </ol>
    </section>
  )
}
