'use client'

import { useActionState } from 'react'
import { setNewPassword, type ResetState } from './actions'
import { PasswordInput } from '@/components/password-input'

const initialState: ResetState = {}

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(setNewPassword, initialState)

  return (
    <form action={formAction} className="mx-auto mt-16 flex max-w-sm flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {state.error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {state.error}{' '}
          {state.error.includes('expired') && (
            <a href="/forgot-password" className="font-semibold underline">
              Get a new link
            </a>
          )}
        </p>
      )}
      <PasswordInput name="password" placeholder="New password" required minLength={8} />
      <PasswordInput name="confirm" placeholder="Type it again" required minLength={8} />
      <button type="submit" disabled={pending} className="rounded bg-fuchsia-600 p-2 font-semibold text-white">
        {pending ? 'Saving…' : 'Save password'}
      </button>
    </form>
  )
}
