import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { joinPendingLeague } from '@/lib/auth/join-pending'
import { type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/** Only same-site paths, so a crafted link can't bounce people to another site. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null
}

/**
 * Landing spot for every emailed auth link:
 *  - ?token_hash=&type=  — our own signup / password-reset links (work in any browser)
 *  - ?code=              — older Supabase-style links (PKCE). These only complete in the
 *                          browser that signed up; elsewhere the email is still confirmed,
 *                          so we send them to log in rather than to an error.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const supabase = await createClient()

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      if (type === 'recovery') redirect(safeNext(searchParams.get('next')) ?? '/reset-password')
      const leagueId = await joinPendingLeague(supabase)
      redirect(leagueId ? `/welcome?league=${leagueId}` : '/dashboard')
    }
    if (type === 'recovery') redirect('/forgot-password')
    redirect('/login?notice=link-expired')
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const leagueId = await joinPendingLeague(supabase)
      redirect(leagueId ? `/welcome?league=${leagueId}` : '/dashboard')
    }
    redirect('/login?notice=confirmed')
  }

  redirect('/login')
}
