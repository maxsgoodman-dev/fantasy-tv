import { createClient } from '@/lib/supabase/server'
import { submitPick, submitBracketPick } from './actions'

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: league } = await supabase.from('leagues').select('name, format, season_id').eq('id', leagueId).single()

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, profiles(display_name)')
    .eq('league_id', leagueId)

  let standingsSource: { user_id: string; points_awarded: number }[] = []

  if (league?.format === 'weekly_vote') {
    const { data: openQuestions } = await supabase
      .from('weekly_questions')
      .select('id, question_text, lock_at')
      .eq('league_id', leagueId)
      .is('resolved_at', null)
      .gt('lock_at', new Date().toISOString())

    const { data: contestants } = await supabase
      .from('contestants')
      .select('id, name')
      .eq('season_id', league!.season_id)
      .order('name')

    const { data: allPicks } = await supabase
      .from('member_picks')
      .select('user_id, points_awarded, weekly_questions!inner(league_id)')
      .eq('weekly_questions.league_id', leagueId)

    standingsSource = allPicks ?? []

    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">{league?.name}</h1>

        <section>
          <h2 className="text-xl font-bold">This week&apos;s picks</h2>
          {openQuestions?.map((q) => (
            <form key={q.id} action={submitPick.bind(null, leagueId, q.id)} className="flex items-center gap-2">
              <span>{q.question_text}</span>
              <select name="contestantId" required className="rounded border p-2">
                {contestants?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Lock in</button>
            </form>
          ))}
        </section>

        <StandingsSection members={members} standingsSource={standingsSource} currentUserId={user!.id} />
      </div>
    )
  }

  // Bracket format
  const { data: matchups } = await supabase
    .from('bracket_matchups')
    .select('id, round, matchup_index, winner_id, contestant_a:contestants!contestant_a_id(id, name), contestant_b:contestants!contestant_b_id(id, name)')
    .eq('league_id', leagueId)
    .order('round')
    .order('matchup_index')

  const { data: allBracketPicks } = await supabase
    .from('member_bracket_picks')
    .select('user_id, points_awarded, bracket_matchups!inner(league_id)')
    .eq('bracket_matchups.league_id', leagueId)

  standingsSource = allBracketPicks ?? []

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{league?.name}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Bracket</h2>
        {matchups?.map((m) => {
          const a = m.contestant_a as unknown as { id: string; name: string } | null
          const b = m.contestant_b as unknown as { id: string; name: string } | null
          return (
            <div key={m.id} className="flex items-center gap-2 border p-2">
              <span>R{m.round} M{m.matchup_index + 1}: {a?.name ?? 'TBD'} vs {b?.name ?? 'TBD'}</span>
              {!m.winner_id && a && b && (
                <form action={submitBracketPick.bind(null, leagueId, m.id)} className="flex gap-2">
                  <select name="predictedWinnerId" required className="rounded border p-1">
                    <option value={a.id}>{a.name}</option>
                    <option value={b.id}>{b.name}</option>
                  </select>
                  <button type="submit" className="rounded bg-fuchsia-600 px-2 text-white">Predict</button>
                </form>
              )}
            </div>
          )
        })}
      </section>

      <StandingsSection members={members} standingsSource={standingsSource} currentUserId={user!.id} />
    </div>
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
