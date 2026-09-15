import { createClient } from '@/lib/supabase/server'
import { submitPick } from './actions'

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: league } = await supabase.from('leagues').select('name, format, season_id').eq('id', leagueId).single()

  const { data: openQuestions } = await supabase
    .from('weekly_questions')
    .select('id, question_text, lock_at, episodes(season_id)')
    .eq('league_id', leagueId)
    .is('resolved_at', null)
    .gt('lock_at', new Date().toISOString())

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq('season_id', league!.season_id)
    .order('name')

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, profiles(display_name)')
    .eq('league_id', leagueId)

  const { data: allPicks } = await supabase
    .from('member_picks')
    .select('user_id, points_awarded, weekly_questions!inner(league_id)')
    .eq('weekly_questions.league_id', leagueId)

  const standings = (members ?? [])
    .map((m) => {
      const total = (allPicks ?? [])
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

      <section>
        <h2 className="text-xl font-bold">Standings</h2>
        <ol className="list-decimal pl-6">
          {standings.map((s) => (
            <li key={s.userId} className={s.userId === user!.id ? 'font-bold' : ''}>
              {s.name}: {s.total} pts
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
