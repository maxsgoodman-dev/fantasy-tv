'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { joinPendingLeague } from '@/lib/auth/join-pending'

export type LoginState = { error?: string }

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }
  const leagueId = await joinPendingLeague(supabase)
  redirect(leagueId ? `/welcome?league=${leagueId}` : '/dashboard')
}
