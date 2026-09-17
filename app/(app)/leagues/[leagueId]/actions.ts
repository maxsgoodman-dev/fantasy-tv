'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveLineup(leagueId: string, episodeId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: episode } = await supabase.from('episodes').select('air_date').eq('id', episodeId).single()
  if (!episode || new Date(episode.air_date) <= new Date()) return // locked

  const contestantIds = formData.getAll('contestantId') as string[]

  const { data: lineup } = await supabase
    .from('weekly_lineups')
    .upsert({ league_id: leagueId, user_id: user.id, episode_id: episodeId }, { onConflict: 'league_id,user_id,episode_id' })
    .select('id')
    .single()

  if (!lineup) return

  await supabase.from('weekly_lineup_picks').delete().eq('lineup_id', lineup.id)
  if (contestantIds.length > 0) {
    await supabase
      .from('weekly_lineup_picks')
      .insert(contestantIds.map((contestantId) => ({ lineup_id: lineup.id, contestant_id: contestantId })))
  }

  revalidatePath(`/leagues/${leagueId}`)
}

export async function saveDraft(leagueId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: league } = await supabase.from('leagues').select('season_id').eq('id', leagueId).single()
  if (!league) return

  const { data: lockEpisode } = await supabase
    .from('episodes')
    .select('air_date')
    .eq('season_id', league.season_id)
    .eq('episode_number', 2)
    .maybeSingle()

  if (lockEpisode && new Date(lockEpisode.air_date) <= new Date()) return // locked

  const contestantIds = formData.getAll('contestantId') as string[]

  await supabase.from('draft_picks').delete().eq('league_id', leagueId).eq('user_id', user.id)
  if (contestantIds.length > 0) {
    await supabase
      .from('draft_picks')
      .insert(contestantIds.map((contestantId) => ({ league_id: leagueId, user_id: user.id, contestant_id: contestantId })))
  }

  revalidatePath(`/leagues/${leagueId}`)
}
