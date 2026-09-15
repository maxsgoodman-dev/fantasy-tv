import { createClient } from '@/lib/supabase/server'
import { createWeeklyQuestion } from './actions'

export const dynamic = 'force-dynamic'

export default async function LeagueQuestionsPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('name, season_id, join_code')
    .eq('id', leagueId)
    .single()
  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, episode_number')
    .eq('season_id', league!.season_id)
    .order('episode_number')

  const { data: questions } = await supabase
    .from('weekly_questions')
    .select('id, question_text, event_type_target, lock_at, resolved_at')
    .eq('league_id', leagueId)

  return (
    <div className="flex flex-col gap-6">
      <a href="/admin/leagues" className="text-sm underline">
        ← Leagues
      </a>
      <h1 className="text-2xl font-bold">{league?.name}</h1>
      <p>
        Join code: <span className="font-mono">{league?.join_code}</span>
      </p>
      <ul className="list-disc pl-6">
        {questions?.map((q) => (
          <li key={q.id}>
            {q.question_text} (target: {q.event_type_target}) — locks {new Date(q.lock_at).toLocaleString()}
            {q.resolved_at ? ' — resolved' : ''}
          </li>
        ))}
      </ul>

      <form action={createWeeklyQuestion.bind(null, leagueId)} className="flex flex-col gap-2 max-w-md">
        <select name="episodeId" required className="rounded border p-2">
          {episodes?.map((e) => <option key={e.id} value={e.id}>Episode {e.episode_number}</option>)}
        </select>
        <input name="questionText" placeholder="Question (e.g. Who gets eliminated?)" required className="rounded border p-2" />
        <input name="eventTypeTarget" placeholder="Event type target (e.g. eliminated)" required className="rounded border p-2" />
        <input name="lockAt" type="datetime-local" required className="rounded border p-2" />
        <button type="submit" className="rounded bg-fuchsia-600 p-2 text-white">Add question</button>
      </form>
    </div>
  )
}
