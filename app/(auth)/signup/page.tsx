'use client'

import { useActionState } from 'react'
import { signup, type SignupState } from './actions'
import { PasswordInput } from '@/components/password-input'

const initialState: SignupState = {}

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState)

  return (
    <form action={formAction} className="mx-auto mt-16 flex max-w-sm flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Sign up for Fantasy TV</h1>
      {state.error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.error}</p>
      )}
      <input name="displayName" placeholder="Display name" required className="rounded border p-2" />
      <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
      <PasswordInput name="password" placeholder="Password" required minLength={8} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-fuchsia-600 p-2 font-semibold text-white"
      >
        {pending ? 'Signing up…' : 'Sign up'}
      </button>
    </form>
  )
}
