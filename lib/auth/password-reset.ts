import { createAuthAdminClient } from './admin-client'
import { resend, EMAIL_FROM } from '@/lib/email/resend'
import { passwordResetEmail } from '@/lib/email/templates'
import { siteOrigin } from '@/lib/email/league-invite'

/**
 * Emails a password-reset link. The link carries a one-time token hash that
 * /auth/confirm verifies, so it works in any browser (unlike Supabase's default
 * PKCE link, which only works in the browser that asked for it).
 *
 * Returns an error message for a real failure, or null. An unknown email is not
 * an error: callers show the same "check your email" message either way, so the
 * form can't be used to find out who has an account.
 */
export async function sendPasswordReset(email: string): Promise<string | null> {
  const admin = createAuthAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data?.properties?.hashed_token) return null // no such account (or nothing to send)

  const origin = await siteOrigin()
  const link =
    `${origin}/auth/confirm?type=recovery&token_hash=${encodeURIComponent(data.properties.hashed_token)}` +
    `&next=${encodeURIComponent('/reset-password')}`
  const { subject, text } = passwordResetEmail(link)
  try {
    const res = await resend.emails.send({ from: EMAIL_FROM, to: email, subject, text })
    if (res.error) return res.error.message
  } catch (e) {
    return e instanceof Error ? e.message : 'send failed'
  }
  return null
}
