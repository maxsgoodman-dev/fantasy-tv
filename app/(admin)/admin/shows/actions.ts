'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function failWith(message: string): never {
  redirect(`/admin/shows?error=${encodeURIComponent(message.slice(0, 300))}`)
}

export async function createShow(formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name'))
  const description = String(formData.get('description') ?? '')
  await supabase.from('shows').insert({ name, description })
  revalidatePath('/admin/shows')
}

export async function createSeason(showId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name'))
  const year = Number(formData.get('year')) || null
  await supabase.from('seasons').insert({ show_id: showId, name, year })
  revalidatePath('/admin/shows')
}

export async function updateShow(showId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name'))
  const description = String(formData.get('description') ?? '')
  const themeColor = String(formData.get('themeColor') ?? '#a21caf')
  const themeFont = String(formData.get('themeFont') ?? 'bold')
  await supabase
    .from('shows')
    .update({ name, description, theme_color: themeColor, theme_font: themeFont })
    .eq('id', showId)
  revalidatePath('/admin/shows')
  revalidatePath('/dashboard')
}

export async function deleteShow(showId: string) {
  const { supabase } = await requireAdmin()

  // leagues.season_id has no ON DELETE CASCADE, so a show whose seasons still have
  // leagues cannot be deleted directly. Remove those leagues first (their members,
  // picks, lineups and brackets cascade from the leagues).
  const { data: seasons, error: seasonsError } = await supabase.from('seasons').select('id').eq('show_id', showId)
  if (seasonsError) failWith(`Could not load seasons: ${seasonsError.message}`)
  const seasonIds = (seasons ?? []).map((s) => s.id)
  if (seasonIds.length > 0) {
    const { error: leaguesError } = await supabase.from('leagues').delete().in('season_id', seasonIds)
    if (leaguesError) failWith(`Could not delete the show's leagues: ${leaguesError.message}`)
  }

  const { data: deleted, error } = await supabase.from('shows').delete().eq('id', showId).select('id')
  if (error) failWith(`Could not delete show: ${error.message}`)
  if (!deleted || deleted.length === 0) failWith('Show was not deleted (not found, or you lack permission).')

  revalidatePath('/admin/shows')
  revalidatePath('/dashboard')
}

export async function updateSeason(seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name'))
  const year = Number(formData.get('year')) || null
  await supabase.from('seasons').update({ name, year }).eq('id', seasonId)
  revalidatePath('/admin/shows')
  revalidatePath(`/admin/seasons/${seasonId}`)
}

export async function deleteSeason(seasonId: string) {
  const { supabase } = await requireAdmin()

  // Same FK gap as deleteShow: clear the season's leagues first.
  const { error: leaguesError } = await supabase.from('leagues').delete().eq('season_id', seasonId)
  if (leaguesError) failWith(`Could not delete the season's leagues: ${leaguesError.message}`)

  const { data: deleted, error } = await supabase.from('seasons').delete().eq('id', seasonId).select('id')
  if (error) failWith(`Could not delete season: ${error.message}`)
  if (!deleted || deleted.length === 0) failWith('Season was not deleted (not found, or you lack permission).')

  revalidatePath('/admin/shows')
  revalidatePath('/dashboard')
}

export async function uploadShowImage(showId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const file = formData.get('image') as File | null
  if (!file || file.size === 0) return { error: 'No file selected' }

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `shows/${showId}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: true })
  if (uploadError) return { error: uploadError.message }

  const { data } = supabase.storage.from('media').getPublicUrl(path)
  await supabase.from('shows').update({ image_url: data.publicUrl }).eq('id', showId)
  revalidatePath('/admin/shows')
}
