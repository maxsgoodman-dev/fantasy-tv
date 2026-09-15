'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { redirect } from 'next/navigation'
import type { ScoringConfig } from '@/lib/scoring/types'

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

  const scoringConfig: ScoringConfig =
    format === 'weekly_vote'
      ? { format: 'weekly_vote', defaultPointsPerCorrect: 5 }
      : { format: 'bracket', roundPoints: [1, 2, 4, 8] }

  const { data, error } = await supabase
    .from('leagues')
    .insert({
      season_id: seasonId,
      name,
      format,
      scoring_config: scoringConfig,
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
