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

  const { data: league } = await supabase
    .from('leagues')
    .select('season_id, max_picks, draft_locks_at')
    .eq('id', leagueId)
    .single()
  if (!league) failSave(leagueId, 'League not found.')

  const { data: lockEpisode } = await supabase
    .from('episodes')
    .select('air_date')
    .eq('season_id', league.season_id)
    .eq('episode_number', 2)
    .maybeSingle()

  const lockAt = league.draft_locks_at ?? lockEpisode?.air_date ?? null
  if (lockAt && new Date(lockAt) <= new Date()) failSave(leagueId, 'The draft is locked.')

  const contestantIds = await onlySeasonContestants(
    supabase,
    league.season_id,
    capPicks(formData.getAll('contestantId') as string[], league.max_picks)
  )

  // Same order as saveLineup: insert/keep the new picks, then drop the rest.
  if (contestantIds.length > 0) {
    const { error } = await supabase
      .from('draft_picks')
      .upsert(
        contestantIds.map((contestantId) => ({ league_id: leagueId, user_id: user.id, contestant_id: contestantId })),
        { onConflict: 'league_id,user_id,contestant_id' }
      )
    if (error) {
      failSave(
        leagueId,
        error.code === '23505'
          ? 'One of those bakers was already drafted by another team. Refresh and pick someone else.'
          : error.message
      )
    }
  }

  let cleanup = supabase.from('draft_picks').delete().eq('league_id', leagueId).eq('user_id', user.id)
  if (contestantIds.length > 0) cleanup = cleanup.not('contestant_id', 'in', `(${contestantIds.join(',')})`)
  const { error: cleanupError } = await cleanup
  if (cleanupError) failSave(leagueId, cleanupError.message)

  revalidatePath(`/leagues/${leagueId}`)
}
