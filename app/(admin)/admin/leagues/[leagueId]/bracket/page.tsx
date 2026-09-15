import { createClient } from '@/lib/supabase/server'
import { seedRoundOne, setMatchupWinner } from './actions'

export const dynamic = 'force-dynamic'

export default async function BracketAdminPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('name, season_id, join_code')
    .eq('id', leagueId)
    .single()

  const { data: matchups } = await supabase
    .from('bracket_matchups')
    .select('id, round, matchup_index, winner_id, contestant_a:contestants!contestant_a_id(id, name), contestant_b:contestants!contestant_b_id(id, name)')
    .eq('league_id', leagueId)
    .order('round')
    .order('matchup_index')

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq('season_id', league!.season_id)
    .order('name')

  return (
    <div className="flex flex-col gap-6">
      <a href="/admin/leagues" className="text-sm underline">
        ← Leagues
      </a>
      <h1 className="text-2xl font-bold">{league?.name}</h1>
      <p>Join code: <span className="font-mono">{league?.join_code}</span></p>

      {(!matchups || matchups.length === 0) && (
        <form action={seedRoundOne.bind(null, leagueId)} className="flex flex-col gap-2">
          <p>Select contestants in matchup order (pairs of two):</p>
          {contestants?.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input type="checkbox" name="contestantId" value={c.id} /> {c.name}
            </label>
          ))}
          <button type="submit" className="w-fit rounded bg-fuchsia-600 px-4 py-2 text-white">Seed round 1</button>
        </form>
      )}

      {matchups?.map((m) => {
        const a = m.contestant_a as unknown as { id: string; name: string } | null
        const b = m.contestant_b as unknown as { id: string; name: string } | null
        return (
          <div key={m.id} className="flex items-center gap-4 border p-2">
            <span>Round {m.round}, Match {m.matchup_index + 1}: {a?.name ?? 'TBD'} vs {b?.name ?? 'TBD'}</span>
            {!m.winner_id && a && b && (
              <form action={setMatchupWinner.bind(null, leagueId, m.id)} className="flex gap-2">
                <select name="winnerId" required className="rounded border p-1">
                  <option value={a.id}>{a.name}</option>
                  <option value={b.id}>{b.name}</option>
                </select>
                <button type="submit" className="rounded bg-fuchsia-600 px-2 text-white">Post winner</button>
              </form>
            )}
            {m.winner_id && <span className="font-bold">Winner set</span>}
          </div>
        )
      })}
    </div>
  )
}
