'use server'

import { z } from 'zod'
import { sendPasswordReset } from '@/lib/auth/password-reset'

export type ForgotState = { error?: string; sent?: boolean }

export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get('email'))
  if (!email.success) return { error: 'Enter the email you signed up with.' }
  const err = await sendPasswordReset(email.data)
  if (err) return { error: `Couldn't send the email: ${err}` }
  return { sent: true }
}
