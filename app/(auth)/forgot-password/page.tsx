'use client'

import { useActionState } from 'react'
import { requestPasswordReset, type ForgotState } from './actions'

const initialState: ForgotState = {}

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)

  if (state.sent) {
    return (
      <div className="mx-auto mt-16 flex max-w-sm flex-col gap-4 p-4">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          If there&apos;s an account for that email, we&apos;ve sent a link to choose a new password. It expires in an hour.
        </p>
        <a href="/login" className="text-sm font-semibold text-fuchsia-700 underline dark:text-fuchsia-300">
          Back to login
        </a>
      </div>
    )
  }

  return (
    <form action={formAction} className="mx-auto mt-16 flex max-w-sm flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Forgot your password?</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Enter the email you signed up with and we&apos;ll send you a link to choose a new one.
      </p>
      {state.error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.error}</p>
      )}
      <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
      <button type="submit" disabled={pending} className="rounded bg-fuchsia-600 p-2 font-semibold text-white">
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
      <a href="/login" className="text-sm underline">
        Back to login
      </a>
    </form>
  )
}
