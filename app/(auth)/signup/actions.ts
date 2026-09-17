'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { resend } from '@/lib/email/resend'
import { welcomeEmail } from '@/lib/email/templates'

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(50),
})

export type SignupState = { error?: string }

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  })
  if (error) {
    return { error: error.message }
  }

  try {
    const { subject, text } = welcomeEmail(parsed.data.displayName)
    await resend.emails.send({
      from: 'Fantasy TV <notify@fantasytv.app>',
      to: parsed.data.email,
      subject,
      text,
    })
  } catch {
    // Don't block signup if the welcome email fails to send.
  }

  redirect('/dashboard')
}
