import { createAuthAdminClient } from './admin-client'
import { resend, EMAIL_FROM } from '@/lib/email/resend'
import { confirmSignupEmail } from '@/lib/email/templates'
import { siteOrigin } from '@/lib/email/league-invite'

/**
 * Creates an unconfirmed account and emails our own confirmation link.
 *
 * Supabase's built-in confirmation email uses a PKCE link that only completes
 * in the browser that signed up and lands on a URL this app never handled, so
 * people tapping it in their mail app got a blank page and were never signed
 * in. Our link carries a one-time token hash that /auth/confirm verifies in
 * any browser, signs them in, joins their league and shows the welcome page.
 */
export async function createAccountWithConfirmation(opts: {
  email: string
  password: string
  data: Record<string, unknown>
  displayName: string
}): Promise<{ error?: string }> {
  const admin = createAuthAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: opts.email,
    password: opts.password,
    options: { data: opts.data },
  })
  if (error || !data?.properties?.hashed_token) {
    if (error && /already (been )?registered|already exists/i.test(error.message)) {
      return {
        error:
          'There’s already an account with that email. Log in instead — or use “Forgot password?” on the login page if you can’t get in.',
      }
    }
    return { error: error?.message ?? 'Could not create your account.' }
  }

  const origin = await siteOrigin()
  const link = `${origin}/auth/confirm?type=signup&token_hash=${encodeURIComponent(data.properties.hashed_token)}`
  const { subject, text } = confirmSignupEmail(opts.displayName, link)
  try {
    const res = await resend.emails.send({ from: EMAIL_FROM, to: opts.email, subject, text })
    if (res.error) return { error: `Account created, but the confirmation email failed to send: ${res.error.message}` }
  } catch (e) {
    return { error: `Account created, but the confirmation email failed to send: ${e instanceof Error ? e.message : 'unknown error'}` }
  }
  return {}
}
