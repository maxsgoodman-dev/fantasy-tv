import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { joinPendingLeague } from '@/lib/auth/join-pending'
import { type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      // Password reset: signed in by the link, now send them to choose a new password.
      // Only same-site paths are honoured so the link can't bounce people elsewhere.
      const next = searchParams.get('next')
      if (type === 'recovery') redirect(next?.startsWith('/') && !next.startsWith('//') ? next : '/reset-password')
      const leagueId = await joinPendingLeague(supabase)
      redirect(leagueId ? `/welcome?league=${leagueId}` : '/dashboard')
    }
  }

  redirect(type === 'recovery' ? '/forgot-password?expired=1' : '/login?error=confirmation_failed')
}
