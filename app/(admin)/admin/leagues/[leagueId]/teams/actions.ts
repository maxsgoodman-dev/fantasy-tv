'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { sendLeagueInvite, type InviteLeagueRow } from '@/lib/email/league-invite'

type Admin = Awaited<ReturnType<typeof requireAdmin>>

function back(leagueId: string, params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString()
  redirect(`/admin/leagues/${leagueId}/teams${qs ? `?${qs}` : ''}`)
}

const EmailSchema = z.string().email()

function parseEmails(raw: string): { emails: string[]; bad: string[] } {
  const all = [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))]
  return { emails: all.filter((e) => EmailSchema.safeParse(e).success), bad: all.filter((e) => !EmailSchema.safeParse(e).success) }
}

/** Puts every league member whose account email is on a team's list onto that team. */
async function syncMembers(admin: Admin, leagueId: string) {
  const { supabase } = admin
  const [{ data: invites }, { data: users }, { data: members }] = await Promise.all([
    supabase.from('league_invites').select('email, team_id').eq('league_id', leagueId).not('team_id', 'is', null),
    supabase.rpc('admin_user_overview'),
    supabase.from('league_members').select('user_id, team_id').eq('league_id', leagueId),
  ])
  const userByEmail = new Map(
    ((users ?? []) as { user_id: string; email: string | null }[]).filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.user_id])
  )
  for (const inv of invites ?? []) {
    const uid = userByEmail.get(inv.email.toLowerCase())
    const m = (members ?? []).find((x) => x.user_id === uid)
    if (m && m.team_id !== inv.team_id) {
      await supabase.from('league_members').update({ team_id: inv.team_id }).eq('league_id', leagueId).eq('user_id', m.user_id)
    }
  }
}

async function addEmails(admin: Admin, leagueId: string, teamId: string, emails: string[], send: boolean): Promise<string[]> {
  const { supabase, userId } = admin
  const problems: string[] = []
  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, join_code, seasons(shows(name))')
    .eq('id', leagueId)
    .single()
  const { data: me } = await supabase.from('profiles').select('display_name').eq('id', userId).single()
  for (const email of emails) {
    const { error } = await supabase
      .from('league_invites')
      .upsert({ league_id: leagueId, email, team_id: teamId, invited_by: userId }, { onConflict: 'league_id,email' })
    if (error) {
      problems.push(`${email} (${error.message})`)
      continue
    }
    if (send && league) {
      const err = await sendLeagueInvite(me?.display_name ?? 'A friend', league as unknown as InviteLeagueRow, email)
      if (err) problems.push(`${email} (email not sent: ${err})`)
    }
  }
  return problems
}

export async function createTeam(leagueId: string, formData: FormData) {
  const admin = await requireAdmin()
  const parsed = z
    .object({
      name: z.string().trim().min(1, 'Give the team a name').max(60),
      spot: z.string().trim().optional(),
    })
    .safeParse({ name: formData.get('name'), spot: formData.get('draft_spot') })
  if (!parsed.success) back(leagueId, { error: parsed.error.issues[0].message })
  const { emails, bad } = parseEmails(String(formData.get('emails') ?? ''))
  if (bad.length) back(leagueId, { error: `Not valid email addresses: ${bad.join(', ')}` })

  const spot = parsed.data.spot ? Number(parsed.data.spot) : null
  const { data: team, error } = await admin.supabase
    .from('league_teams')
    .insert({ league_id: leagueId, name: parsed.data.name, draft_spot: Number.isFinite(spot) ? spot : null })
    .select('id')
    .single()
  if (error || !team) back(leagueId, { error: error?.message ?? 'Could not create the team' })

  const problems = await addEmails(admin, leagueId, team.id, emails, formData.get('send') === 'on')
  await syncMembers(admin, leagueId)
  revalidatePath(`/admin/leagues/${leagueId}/teams`)
  back(leagueId, problems.length ? { error: `Team created, but: ${problems.join('; ')}` } : { ok: 'Team created.' })
}

export async function addTeamEmails(leagueId: string, teamId: string, formData: FormData) {
  const admin = await requireAdmin()
  const { emails, bad } = parseEmails(String(formData.get('emails') ?? ''))
  if (bad.length) back(leagueId, { error: `Not valid email addresses: ${bad.join(', ')}` })
  if (emails.length === 0) back(leagueId, { error: 'Enter at least one email.' })
  const problems = await addEmails(admin, leagueId, teamId, emails, formData.get('send') === 'on')
  await syncMembers(admin, leagueId)
  revalidatePath(`/admin/leagues/${leagueId}/teams`)
  back(leagueId, problems.length ? { error: problems.join('; ') } : { ok: 'Saved.' })
}

export async function removeTeamEmail(leagueId: string, formData: FormData) {
  const admin = await requireAdmin()
  const id = z.string().uuid().safeParse(formData.get('invite_id'))
  if (!id.success) back(leagueId, { error: 'Invalid email' })
  const { data: inv } = await admin.supabase.from('league_invites').select('email').eq('id', id.data!).single()
  await admin.supabase.from('league_invites').update({ team_id: null }).eq('id', id.data!)
  // If that person already joined, take them off the team too.
  const { data: users } = await admin.supabase.rpc('admin_user_overview')
  const uid = ((users ?? []) as { user_id: string; email: string | null }[]).find(
    (u) => u.email?.toLowerCase() === inv?.email.toLowerCase()
  )?.user_id
  if (uid) await admin.supabase.from('league_members').update({ team_id: null }).eq('league_id', leagueId).eq('user_id', uid)
  revalidatePath(`/admin/leagues/${leagueId}/teams`)
  back(leagueId, { ok: 'Email removed from the team.' })
}

export async function assignMember(leagueId: string, formData: FormData) {
  const admin = await requireAdmin()
  const parsed = z
    .object({ userId: z.string().uuid(), teamId: z.string().uuid() })
    .safeParse({ userId: formData.get('user_id'), teamId: formData.get('team_id') })
  if (!parsed.success) back(leagueId, { error: 'Pick a team first.' })
  const { error } = await admin.supabase
    .from('league_members')
    .update({ team_id: parsed.data.teamId })
    .eq('league_id', leagueId)
    .eq('user_id', parsed.data.userId)
  if (error) back(leagueId, { error: error.message })
  revalidatePath(`/admin/leagues/${leagueId}/teams`)
  back(leagueId, { ok: 'Member added to the team.' })
}

export async function deleteTeam(leagueId: string, teamId: string) {
  const admin = await requireAdmin()
  const { count } = await admin.supabase
    .from('draft_picks')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
  if ((count ?? 0) > 0) back(leagueId, { error: 'Clear this team’s picks first, then delete it.' })
  const { error } = await admin.supabase.from('league_teams').delete().eq('id', teamId)
  if (error) back(leagueId, { error: error.message })
  revalidatePath(`/admin/leagues/${leagueId}/teams`)
  back(leagueId, { ok: 'Team deleted.' })
}

/** Admin override: set exactly which bakers a team has (used to enter the in-person draft). */
export async function setTeamPicks(leagueId: string, teamId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const { data: league } = await supabase.from('leagues').select('season_id, max_picks').eq('id', leagueId).single()
  if (!league) back(leagueId, { error: 'League not found.' })

  const wanted = [...new Set(formData.getAll('contestantId').map(String))]
  const { data: valid } = wanted.length
    ? await supabase.from('contestants').select('id').eq('season_id', league.season_id).in('id', wanted)
    : { data: [] as { id: string }[] }
  const ids = (valid ?? []).map((c) => c.id)
  if (league.max_picks && ids.length > league.max_picks) {
    back(leagueId, { error: `A team can have at most ${league.max_picks} bakers.` })
  }

  const { data: all } = await supabase.from('draft_picks').select('id, team_id, contestant_id').eq('league_id', leagueId)
  const taken = (all ?? []).filter((p) => p.team_id !== teamId && ids.includes(p.contestant_id))
  if (taken.length) back(leagueId, { error: 'One of those bakers is already on another team.' })

  const mine = (all ?? []).filter((p) => p.team_id === teamId)
  const toAdd = ids.filter((id) => !mine.some((p) => p.contestant_id === id))
  const toDrop = mine.filter((p) => !ids.includes(p.contestant_id)).map((p) => p.id)

  if (toAdd.length) {
    const { error } = await supabase
      .from('draft_picks')
      .insert(toAdd.map((contestant_id) => ({ league_id: leagueId, team_id: teamId, contestant_id })))
    if (error) back(leagueId, { error: error.message })
  }
  if (toDrop.length) {
    const { error } = await supabase.from('draft_picks').delete().in('id', toDrop)
    if (error) back(leagueId, { error: error.message })
  }
  revalidatePath(`/admin/leagues/${leagueId}/teams`)
  revalidatePath(`/leagues/${leagueId}`)
  back(leagueId, { ok: 'Picks saved.' })
}
