'use server'

import { createClient } from '@/lib/supabase/server'
import { joinPendingLeague } from '@/lib/auth/join-pending'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { resend, EMAIL_FROM } from '@/lib/email/resend'
import { welcomeEmail } from '@/lib/email/templates'

const JoinSignupSchema = z.object({
  code: z.string().trim().min(1, 'Enter your league join code').max(20),
  username: z.string().trim().min(2, 'Username must be at least 2 characters').max(30, 'Username is too long (30 max)'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type JoinSignupState = { error?: string; confirmationSent?: boolean; leagueName?: string }

/** One-step invite signup: validates the code, creates the account, joins the league. */
export async function signupAndJoin(_prev: JoinSignupState, formData: FormData): Promise<JoinSignupState> {
  const parsed = JoinSignupSchema.safeParse({
    code: formData.get('code'),
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const code = parsed.data.code.toUpperCase()
  const supabase = await createClient()

  // Check the code BEFORE creating an account so a typo never leaves a half-finished signup.
  const { data: preview } = await supabase.rpc('league_invite_preview', { p_code: code })
  const leagueName = (preview as { league_name: string }[] | null)?.[0]?.league_name
  if (!leagueName) {
    return { error: "That join code doesn't match a league. Double-check it with whoever invited you." }
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.username, join_code: code } },
  })
  if (error) return { error: error.message }

  // Email confirmation on: no session yet. The code rides along in the user's metadata and
  // the league is joined automatically when they confirm (see /auth/confirm) or log in.
  if (!data.session) return { confirmationSent: true, leagueName }

  const leagueId = await joinPendingLeague(supabase)

  try {
    const { subject, text } = welcomeEmail(parsed.data.username)
    await resend.emails.send({ from: EMAIL_FROM, to: parsed.data.email, subject, text })
  } catch {
    // Don't block signup if the welcome email fails to send.
  }

  redirect(leagueId ? `/welcome?league=${leagueId}` : '/dashboard')
}

/** For people who already have an account and are signed in: join with one click. */
export async function joinExistingAndGo(code: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/join/${encodeURIComponent(code)}`)

  const { data: leagueId, error } = await supabase.rpc('join_league_by_code', { p_code: code.trim().toUpperCase() })
  if (error || !leagueId) {
    redirect(`/join/${encodeURIComponent(code)}?error=${encodeURIComponent(error?.message ?? 'Could not join this league.')}`)
  }
  redirect(`/welcome?league=${leagueId}`)
}
