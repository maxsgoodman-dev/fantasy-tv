'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

export async function addContestant(seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name'))
  const bio = String(formData.get('bio') ?? '')
  await supabase.from('contestants').insert({ season_id: seasonId, name, bio })
  revalidatePath(`/admin/seasons/${seasonId}`)
}

export async function addEpisode(seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const episodeNumber = Number(formData.get('episodeNumber'))
  const airDate = String(formData.get('airDate'))
  await supabase.from('episodes').insert({
    season_id: seasonId,
    episode_number: episodeNumber,
    air_date: airDate,
  })
  revalidatePath(`/admin/seasons/${seasonId}`)
}

export async function updateContestant(contestantId: string, seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name'))
  const bio = String(formData.get('bio') ?? '')
  await supabase.from('contestants').update({ name, bio }).eq('id', contestantId)
  revalidatePath(`/admin/seasons/${seasonId}`)
}

export async function deleteContestant(contestantId: string, seasonId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('contestants').delete().eq('id', contestantId)
  revalidatePath(`/admin/seasons/${seasonId}`)
}

export async function updateEpisode(episodeId: string, seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const episodeNumber = Number(formData.get('episodeNumber'))
  const airDate = String(formData.get('airDate'))
  await supabase
    .from('episodes')
    .update({ episode_number: episodeNumber, air_date: airDate })
    .eq('id', episodeId)
  revalidatePath(`/admin/seasons/${seasonId}`)
}

export async function deleteEpisode(episodeId: string, seasonId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('episodes').delete().eq('id', episodeId)
  revalidatePath(`/admin/seasons/${seasonId}`)
}
