import { headers } from 'next/headers'
import { resend, EMAIL_FROM } from '@/lib/email/resend'
import { leagueInviteEmail } from '@/lib/email/templates'

export type InviteLeagueRow = {
  id: string
  name: string
  join_code: string
  seasons: { shows: { name: string } | null } | null
}

export async function siteOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Emails a league invite link + code. Returns an error message, or null when sent. */
export async function sendLeagueInvite(
  inviterName: string,
  league: InviteLeagueRow,
  email: string
): Promise<string | null> {
  const origin = await siteOrigin()
  const { subject, text } = leagueInviteEmail({
    inviterName,
    leagueName: league.name,
    showName: league.seasons?.shows?.name ?? 'reality TV',
    link: `${origin}/join/${encodeURIComponent(league.join_code)}`,
    code: league.join_code,
  })
  try {
    const res = await resend.emails.send({ from: EMAIL_FROM, to: email, subject, text })
    if (res.error) return res.error.message
  } catch (e) {
    return e instanceof Error ? e.message : 'send failed'
  }
  return null
}
