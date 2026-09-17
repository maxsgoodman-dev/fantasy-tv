'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'
import { PasswordInput } from '@/components/password-input'

const initialState: LoginState = {}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <form action={formAction} className="mx-auto mt-16 flex max-w-sm flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Log in</h1>
      {state.error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.error}</p>
      )}
      <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
      <PasswordInput name="password" placeholder="Password" required />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-fuchsia-600 p-2 font-semibold text-white"
      >
        {pending ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  )
}
