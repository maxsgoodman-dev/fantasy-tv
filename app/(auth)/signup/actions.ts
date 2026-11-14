'use server'

import { z } from 'zod'
import { createAccountWithConfirmation } from '@/lib/auth/signup-email'

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(50),
})

export type SignupState = { error?: string; confirmationSent?: boolean }

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { error } = await createAccountWithConfirmation({
    email: parsed.data.email,
    password: parsed.data.password,
    data: { display_name: parsed.data.displayName },
    displayName: parsed.data.displayName,
  })
  if (error) return { error }
  return { confirmationSent: true }
}
