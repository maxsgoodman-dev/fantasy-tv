import { createClient } from '@/lib/supabase/server'
import { scoreWeeklyLineup } from '@/lib/scoring/weekly-team'
import { effectivePoints, readOverrides } from '@/lib/scoring/league-rules'

export const dynamic = 'force-dynamic'

export default async function LeagueDraftOverviewPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('name, season_id, join_code, scoring_overrides')
    .eq('id', leagueId)
    .single()

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, episode_number, air_date')
    .eq('season_id', league!.season_id)
    .order('episode_number')

  const draftLockEpisode = episodes?.find((e) => e.episode_number === 2)
  const draftLocked = draftLockEpisode ? draftLockEpisode.air_date <= new Date().toISOString() : false

  const { data: eliminationEvents } = await supabase
    .from('episode_events')
    .select('contestant_id')
    .eq('event_type', 'eliminated')
    .in('episode_id', (episodes ?? []).map((e) => e.id))

  const eliminatedContestantIds = new Set((eliminationEvents ?? []).map((e) => e.contestant_id))

  const { data: allSeasonEvents } = await supabase
    .from('contestant_episode_events')
    .select('contestant_id, points, event_code, episodes!inner(season_id)')
    .eq('episodes.season_id', league!.season_id)

  const seasonEventPoints = (allSeasonEvents ?? []).map((e) => ({
    contestantId: e.contestant_id,
    points: effectivePoints(e.event_code, e.points, readOverrides(league?.scoring_overrides)),
  }))

  const { data: draftPicks } = await supabase
    .from('draft_picks')
    .select('user_id, contestant_id, profiles(display_name), contestants(name)')
    .eq('league_id', leagueId)

  const byMember = new Map<string, { name: string; picks: { name: string; contestantId: string }[] }>()
  for (const p of draftPicks ?? []) {
    const memberName = (p.profiles as unknown as { display_name: string } | null)?.display_name ?? 'Member'
    const contestantName = (p.contestants as unknown as { name: string } | null)?.name ?? 'Unknown'
    if (!byMember.has(p.user_id)) byMember.set(p.user_id, { name: memberName, picks: [] })
    byMember.get(p.user_id)!.picks.push({ name: contestantName, contestantId: p.contestant_id })
  }

  return (
    <div className="flex flex-col gap-6">
      <a href="/admin/leagues" className="text-sm underline">
        ← Leagues
      </a>
      <h1 className="text-2xl font-bold">{league?.name}</h1>
      <p>
        Join code: <span className="font-mono">{league?.join_code}</span>
      </p>
      <p className="text-sm text-zinc-600">
        This is a season-long draft league — members pick their team themselves (locks when Episode 2
        airs{draftLockEpisode ? `, ${new Date(draftLockEpisode.air_date).toLocaleString()}` : ''}). Log
        events for each episode from the &quot;Log events&quot; page — points accumulate automatically for
        every drafted contestant. Draft status: <strong>{draftLocked ? 'Locked' : 'Open'}</strong>.
      </p>

      <div className="card flex flex-col gap-4 p-4">
        <h2 className="text-xl font-bold">Draft board</h2>
        {byMember.size === 0 && <p className="text-zinc-600">No one has drafted a team yet.</p>}
        {Array.from(byMember.entries()).map(([userId, m]) => (
          <div key={userId}>
            <p className="font-semibold">{m.name}</p>
            <ul className="list-disc pl-6 text-sm">
              {m.picks.map((pick) => {
                const isOut = eliminatedContestantIds.has(pick.contestantId)
                const points = scoreWeeklyLineup([{ contestantId: pick.contestantId }], seasonEventPoints)
                return (
                  <li key={pick.contestantId}>
                    {pick.name} — {isOut ? 'eliminated' : 'still in'} ({points} pts)
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
