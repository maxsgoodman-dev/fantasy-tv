'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function joinLeague(formData: FormData) {
  const supabase = await createClient()
  const code = String(formData.get('code')).trim().toUpperCase()
  const { error } = await supabase.rpc('join_league_by_code', { p_code: code })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
}
