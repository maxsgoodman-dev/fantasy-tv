'use client'

import { useActionState } from 'react'
import { signupAndJoin, type JoinSignupState } from '../actions'
import { PasswordInput } from '@/components/password-input'

const initialState: JoinSignupState = {}

export function JoinForm({ code, leagueName }: { code: string; leagueName: string | null }) {
  const [state, formAction, pending] = useActionState(signupAndJoin, initialState)

  if (state.confirmationSent) {
    return (
      <div className="card flex flex-col gap-3 p-6">
        <h2 className="text-xl font-bold">Check your email</h2>
        <p className="text-sm text-zinc-600">
          We sent you a confirmation link. Tap it and you&apos;ll be added to{' '}
          <strong>{state.leagueName ?? leagueName ?? 'the league'}</strong> automatically.
        </p>
        <a href="/login" className="text-sm font-semibold text-fuchsia-700 underline dark:text-fuchsia-300">
          Already confirmed? Log in
        </a>
      </div>
    )
  }

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-6">
      <h2 className="text-xl font-bold">Create your account</h2>
      {state.error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        League join code
        <input
          name="code"
          defaultValue={code}
          required
          autoCapitalize="characters"
          autoComplete="off"
          className="rounded border p-2 text-base font-semibold uppercase tracking-widest"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Username
        <input
          name="username"
          required
          minLength={2}
          maxLength={30}
          autoComplete="username"
          placeholder="What should your league call you?"
          className="rounded border p-2 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="email" className="rounded border p-2 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
        <PasswordInput name="password" required minLength={8} placeholder="At least 8 characters" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-fuchsia-600 p-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Joining…' : 'Create account & join'}
      </button>
      <p className="text-center text-sm text-zinc-600">
        Already have an account?{' '}
        <a href="/login" className="font-semibold text-fuchsia-700 underline dark:text-fuchsia-300">
          Log in
        </a>
        , then enter the code from your dashboard.
      </p>
    </form>
  )
}
