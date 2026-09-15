'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) return { error: 'No file selected' }

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `avatars/${user.id}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: true })
  if (uploadError) return { error: uploadError.message }

  const { data } = supabase.storage.from('media').getPublicUrl(path)
  await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
  revalidatePath('/profile')
  revalidatePath('/dashboard')
}
