'use client'

import { useActionState } from 'react'
import { joinLeague, type JoinLeagueState } from './actions'

const initialState: JoinLeagueState = {}

export function JoinLeagueForm() {
  const [state, formAction, pending] = useActionState(joinLeague, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input name="code" placeholder="Join code" required className="rounded border p-2 uppercase" />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-fuchsia-600 px-4 text-white"
        >
          {pending ? 'Joining…' : 'Join'}
        </button>
      </div>
      {state.error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.error}</p>
      )}
    </form>
  )
}
