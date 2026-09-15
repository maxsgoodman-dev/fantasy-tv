'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'
import { parseTwoColumnCsv } from '@/lib/csv'

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

export async function uploadContestantPhoto(contestantId: string, seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const file = formData.get('photo') as File | null
  if (!file || file.size === 0) return { error: 'No file selected' }

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `contestants/${contestantId}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: true })
  if (uploadError) return { error: uploadError.message }

  const { data } = supabase.storage.from('media').getPublicUrl(path)
  await supabase.from('contestants').update({ photo_url: data.publicUrl }).eq('id', contestantId)
  revalidatePath(`/admin/seasons/${seasonId}`)
}

export async function importContestants(seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const raw = String(formData.get('csv') ?? '')
  const rows = parseTwoColumnCsv(raw)
  if (rows.length === 0) return

  await supabase
    .from('contestants')
    .insert(rows.map(([name, bio]) => ({ season_id: seasonId, name, bio: bio || null })))
  revalidatePath(`/admin/seasons/${seasonId}`)
}

export async function importEpisodes(seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const raw = String(formData.get('csv') ?? '')
  const rows = parseTwoColumnCsv(raw)
  const episodes = rows
    .filter(([num, date]) => num && date)
    .map(([num, date]) => ({
      season_id: seasonId,
      episode_number: Number(num),
      air_date: date,
    }))
  if (episodes.length === 0) return

  await supabase.from('episodes').insert(episodes)
  revalidatePath(`/admin/seasons/${seasonId}`)
}
