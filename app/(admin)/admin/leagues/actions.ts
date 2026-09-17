'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { redirect } from 'next/navigation'

function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

export async function createLeague(formData: FormData) {
  const { supabase, userId } = await requireAdmin()
  const seasonId = String(formData.get('seasonId'))
  const name = String(formData.get('name'))
  const format = String(formData.get('format')) as 'bracket' | 'weekly_vote'

  const { data, error } = await supabase
    .from('leagues')
    .insert({
      season_id: seasonId,
      name,
      format,
      join_code: generateJoinCode(),
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  redirect(
    format === 'bracket'
      ? `/admin/leagues/${data.id}/bracket`
      : `/admin/leagues/${data.id}/questions`
  )
}
