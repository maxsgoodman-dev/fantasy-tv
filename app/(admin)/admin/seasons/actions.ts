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
