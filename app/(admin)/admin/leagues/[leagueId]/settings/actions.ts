'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { rulesetForShowName } from '@/lib/scoring/rulesets'
import { buildOverrides } from '@/lib/scoring/league-rules'
import { revalidatePath } from 'next/cache'

async function showNameForLeague(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  leagueId: string
) {
  const { data } = await supabase.from('leagues').select('seasons(shows(name))').eq('id', leagueId).single()
  return (data?.seasons as { shows: { name: string } } | null)?.shows?.name
}

export async function saveLeagueSettings(leagueId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const rules = rulesetForShowName(await showNameForLeague(supabase, leagueId))

  const submitted: Record<string, string> = {}
  for (const rule of rules) submitted[rule.code] = String(formData.get(`points_${rule.code}`) ?? '')

  const rawMax = String(formData.get('maxPicks') ?? '').trim()
  const maxPicks = rawMax === '' ? null : Math.max(1, Math.floor(Number(rawMax))) || null

  await supabase
    .from('leagues')
    .update({ max_picks: maxPicks, scoring_overrides: buildOverrides(rules, submitted) })
    .eq('id', leagueId)

  revalidatePath(`/admin/leagues/${leagueId}/settings`)
  revalidatePath(`/leagues/${leagueId}`)
}

export async function resetScoringToDefaults(leagueId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('leagues').update({ scoring_overrides: {} }).eq('id', leagueId)
  revalidatePath(`/admin/leagues/${leagueId}/settings`)
  revalidatePath(`/leagues/${leagueId}`)
}
