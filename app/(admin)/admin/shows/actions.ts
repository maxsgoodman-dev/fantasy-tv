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
