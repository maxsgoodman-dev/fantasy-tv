'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { sendLeagueInvite, type InviteLeagueRow } from '@/lib/email/league-invite'

function back(params: Record<string, string>): never {
  redirect(`/admin/invites?${new URLSearchParams(params).toString()}`)
}

async function sendInvite(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  adminId: string,
  league: InviteLeagueRow,
  email: string
): Promise<string | null> {
  const { data: me } = await supabase.from('profiles').select('display_name').eq('id', adminId).single()
  return sendLeagueInvite(me?.display_name ?? 'A friend', league, email)
}

const InviteSchema = z.object({
  leagueId: z.string().uuid('Pick a league'),
  emails: z.string().min(1, 'Enter at least one email'),
})

export async function inviteByEmail(formData: FormData) {
  const { supabase, userId } = await requireAdmin()
  const parsed = InviteSchema.safeParse({
    leagueId: formData.get('league_id'),
    emails: formData.get('emails'),
  })
  if (!parsed.success) back({ error: parsed.error.issues[0].message })

  const emailSchema = z.string().email()
  const all = parsed.data.emails
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const emails = [...new Set(all)]
  const bad = emails.filter((e) => !emailSchema.safeParse(e).success)
  if (bad.length) back({ error: `Not valid email addresses: ${bad.join(', ')}` })
  if (emails.length === 0) back({ error: 'Enter at least one email' })
  if (emails.length > 25) back({ error: 'Invite up to 25 people at a time' })

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, join_code, seasons(shows(name))')
    .eq('id', parsed.data.leagueId)
    .single()
  if (!league) back({ error: 'League not found' })

  const failed: string[] = []
  let sent = 0
  for (const email of emails) {
    const { error } = await supabase
      .from('league_invites')
      .upsert(
        { league_id: league!.id, email, invited_by: userId, last_sent_at: new Date().toISOString() },
        { onConflict: 'league_id,email' }
      )
    if (error) {
      failed.push(`${email} (${error.message})`)
      continue
    }
    const sendErr = await sendInvite(supabase, userId, league as unknown as InviteLeagueRow, email)
    if (sendErr) failed.push(`${email} (email not sent: ${sendErr})`)
    else sent++
  }

  revalidatePath('/admin/invites')
  const params: Record<string, string> = { sent: String(sent) }
  if (failed.length) params.error = `Problems: ${failed.join('; ')}`
  back(params)
}

export async function resendInvite(formData: FormData) {
  const { supabase, userId } = await requireAdmin()
  const id = z.string().uuid().safeParse(formData.get('invite_id'))
  if (!id.success) back({ error: 'Invalid invite' })
  const { data: invite } = await supabase
    .from('league_invites')
    .select('id, email, leagues(id, name, join_code, seasons(shows(name)))')
    .eq('id', id.data!)
    .single()
  if (!invite) back({ error: 'Invite not found' })
  const league = invite!.leagues as unknown as InviteLeagueRow
  const sendErr = await sendInvite(supabase, userId, league, invite!.email)
  if (sendErr) back({ error: `Email not sent: ${sendErr}` })
  await supabase.from('league_invites').update({ last_sent_at: new Date().toISOString() }).eq('id', id.data!)
  revalidatePath('/admin/invites')
  back({ sent: '1' })
}

export async function deleteInvite(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = z.string().uuid().safeParse(formData.get('invite_id'))
  if (!id.success) back({ error: 'Invalid invite' })
  const { error } = await supabase.from('league_invites').delete().eq('id', id.data!)
  if (error) back({ error: `Couldn't remove invite: ${error.message}` })
  revalidatePath('/admin/invites')
  back({})
}
