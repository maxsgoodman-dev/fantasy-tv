'use client'

import { useState } from 'react'

/** Invite panel: shows the join code and shares a one-tap join link (/join/CODE). */
export function ShareLeague({ leagueName, joinCode }: { leagueName: string; joinCode: string }) {
  const [message, setMessage] = useState<string | null>(null)

  function inviteUrl() {
    return `${window.location.origin}/join/${encodeURIComponent(joinCode)}`
  }

  async function copy() {
    const url = inviteUrl()
    try {
      await navigator.clipboard.writeText(url)
      setMessage('Invite link copied!')
    } catch {
      setMessage(`Copy this link: ${url}`)
    }
  }

  async function share() {
    const url = inviteUrl()
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Join ${leagueName} on Fantasy TV`,
          text: `Join my "${leagueName}" league on Fantasy TV!`,
          url,
        })
        return
      } catch {
        // dismissed, or share failed: fall through to copy
      }
    }
    await copy()
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 p-3">
      <div className="flex flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Invite friends</span>
        <span className="text-lg font-bold tracking-widest">{joinCode}</span>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <button type="button" onClick={share} className="rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white">
          Share invite
        </button>
        <button type="button" onClick={copy} className="rounded-full border border-fuchsia-600 px-4 py-2 text-sm font-semibold text-fuchsia-700">
          Copy link
        </button>
      </div>
      {message && (
        <p role="status" className="w-full text-sm text-zinc-600">
          {message}
        </p>
      )}
    </div>
  )
}
