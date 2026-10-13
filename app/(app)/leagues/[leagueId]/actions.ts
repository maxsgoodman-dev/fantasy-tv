'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/** Dedupes and enforces the league's pick limit server-side (the UI limit can be bypassed). */
function capPicks(ids: string[], maxPicks: number | null | undefined) {
  const unique = Array.from(new Set(ids))
  return maxPicks ? unique.slice(0, maxPicks) : unique
}

function failSave(leagueId: string, message: string): never {
  redirect(`/leagues/${leagueId}?saveError=${encodeURIComponent(message.slice(0, 200))}`)
}

/** Keeps only contestants that belong to the league's season (ids come from the client). */
async function onlySeasonContestants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  seasonId: string,
  ids: string[]
): Promise<string[]> {
  if (ids.length === 0) return []
  const { data } = await supabase.from('contestants').select('id').eq('season_id', seasonId).in('id', ids)
  const valid = new Set((data ?? []).map((c: { id: string }) => c.id))
  return ids.filter((id) => valid.has(id))
}

export async function saveLineup(leagueId: string, episodeId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: episode } = await supabase.from('episodes').select('air_date').eq('id', episodeId).single()
  if (!episode) failSave(leagueId, 'Episode not found.')
  if (new Date(episode.air_date) <= new Date()) failSave(leagueId, 'That episode has already aired, so picks are locked.')

  const { data: league } = await supabase.from('leagues').select('season_id, max_picks').eq('id', leagueId).single()
  if (!league) failSave(leagueId, 'League not found.')
  const contestantIds = await onlySeasonContestants(
    supabase,
    league.season_id,
    capPicks(formData.getAll('contestantId') as string[], league.max_picks)
  )

  // Members of a team share one lineup per episode; the database function checks membership,
  // the lock and the pick limit and lets any teammate edit it.
  const { data: membership } = await supabase
    .from('league_members')
    .select('team_id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membership?.team_id) {
    const { data: message, error } = await supabase.rpc('save_team_lineup', {
      p_league_id: leagueId,
      p_episode_id: episodeId,
      p_contestant_ids: contestantIds,
    })
    if (error) failSave(leagueId, error.message)
    if (message) failSave(leagueId, String(message))
    revalidatePath(`/leagues/${leagueId}`)
    return
  }

  const { data: lineup, error: lineupError } = await supabase
    .from('weekly_lineups')
    .upsert({ league_id: leagueId, user_id: user.id, episode_id: episodeId }, { onConflict: 'league_id,user_id,episode_id' })
    .select('id')
    .single()
  if (lineupError || !lineup) failSave(leagueId, lineupError?.message ?? 'Could not save your team.')

  // Write the new picks first and only then remove the ones that were dropped, so a failure
  // part-way through can never leave the member with an empty team.
  if (contestantIds.length > 0) {
    const { error } = await supabase
      .from('weekly_lineup_picks')
      .upsert(
        contestantIds.map((contestantId) => ({ lineup_id: lineup.id, contestant_id: contestantId })),
        { onConflict: 'lineup_id,contestant_id' }
      )
    if (error) failSave(leagueId, error.message)
  }

  let cleanup = supabase.from('weekly_lineup_picks').delete().eq('lineup_id', lineup.id)
  if (contestantIds.length > 0) cleanup = cleanup.not('contestant_id', 'in', `(${contestantIds.join(',')})`)
  const { error: cleanupError } = await cleanup
  if (cleanupError) failSave(leagueId, cleanupError.message)

  revalidatePath(`/leagues/${leagueId}`)
}

export async function saveDraft(leagueId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase.from('leagues').select('season_id, max_picks').eq('id', leagueId).single()
  if (!league) failSave(leagueId, 'League not found.')

  const contestantIds = await onlySeasonContestants(
    supabase,
    league.season_id,
    capPicks(formData.getAll('contestantId') as string[], league.max_picks)
  )

  // One atomic, team-aware write in the database: it checks membership, the draft lock, the
  // pick limit, "one team per baker" and eliminations, and lets any member of a team edit
  // the team's shared picks. It returns a message on failure and null on success.
  const { data: message, error } = await supabase.rpc('save_team_draft', {
    p_league_id: leagueId,
    p_contestant_ids: contestantIds,
  })
  if (error) failSave(leagueId, error.message)
  if (message) failSave(leagueId, String(message))

  revalidatePath(`/leagues/${leagueId}`)
}
