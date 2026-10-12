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

  // datetime-local has no timezone; interpret it as US Eastern.
  const rawLock = String(formData.get('draftLocksAt') ?? '').trim()
  let draftLocksAt: string | null = null
  if (rawLock) {
    const asUtc = new Date(`${rawLock}:00Z`)
    if (!Number.isNaN(asUtc.getTime())) {
      const east = new Date(asUtc.toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' UTC')
      draftLocksAt = new Date(asUtc.getTime() + (asUtc.getTime() - east.getTime())).toISOString()
    }
  }

  await supabase
    .from('leagues')
    .update({ max_picks: maxPicks, draft_locks_at: draftLocksAt, scoring_overrides: buildOverrides(rules, submitted) })
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
