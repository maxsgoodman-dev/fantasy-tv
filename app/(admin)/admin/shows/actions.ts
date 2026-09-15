'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

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
  await supabase.from('shows').update({ name, description }).eq('id', showId)
  revalidatePath('/admin/shows')
}

export async function deleteShow(showId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('shows').delete().eq('id', showId)
  revalidatePath('/admin/shows')
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
  await supabase.from('seasons').delete().eq('id', seasonId)
  revalidatePath('/admin/shows')
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
