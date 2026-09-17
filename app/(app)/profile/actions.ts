'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateDisplayName(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const displayName = String(formData.get('displayName') ?? '').trim()
  if (!displayName) return

  await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id)
  revalidatePath('/profile')
  revalidatePath('/dashboard')
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) return

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `avatars/${user.id}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: true })
  if (uploadError) return

  const { data } = supabase.storage.from('media').getPublicUrl(path)
  await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
  revalidatePath('/profile')
  revalidatePath('/dashboard')
}

export async function updateLeagueName(leagueId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const displayName = String(formData.get('displayName') ?? '').trim()

  await supabase
    .from('league_members')
    .update({ display_name: displayName || null })
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
  revalidatePath('/profile')
  revalidatePath(`/leagues/${leagueId}`)
}

export async function uploadLeagueAvatar(leagueId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) return

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `avatars/${user.id}/league-${leagueId}-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: true })
  if (uploadError) return

  const { data } = supabase.storage.from('media').getPublicUrl(path)
  await supabase
    .from('league_members')
    .update({ avatar_url: data.publicUrl })
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
  revalidatePath('/profile')
  revalidatePath(`/leagues/${leagueId}`)
}
