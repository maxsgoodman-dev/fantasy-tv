'use client'

import { useState } from 'react'

interface Contestant {
  id: string
  name: string
  photo_url: string | null
}

function ContestantPhoto({ url, name, size = 'lg' }: { url: string | null; name: string; size?: 'lg' | 'sm' }) {
  const dims = size === 'lg' ? 'h-24 w-24 sm:h-32 sm:w-32' : 'h-10 w-10'
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`${dims} rounded-lg object-cover`} />
  }
  return (
    <div className={`${dims} flex items-center justify-center rounded-lg bg-zinc-200 text-center text-xs text-zinc-500`}>
      No photo
    </div>
  )
}

/**
 * Two-panel pick UI: a clickable photo grid of every contestant, plus a
 * vertical "your picks" list beside it (below it on mobile) that fills in
 * live as tiles are selected. Selected contestant ids are mirrored into
 * hidden inputs named "contestantId" so the surrounding <form> still submits
 * plain FormData to a server action, unchanged.
 */
export function TeamPicker({
  contestants,
  initialSelectedIds,
  maxPicks = null,
  takenIds = [],
  eliminatedIds = [],
}: {
  contestants: Contestant[]
  initialSelectedIds: string[]
  maxPicks?: number | null
  /** Contestants already drafted by another team (each can only be on one team). */
  takenIds?: string[]
  /** Contestants already out of the show (can't earn points, so not draftable). */
  eliminatedIds?: string[]
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    maxPicks ? initialSelectedIds.slice(0, maxPicks) : initialSelectedIds
  )
  const atLimit = maxPicks != null && selectedIds.length >= maxPicks

  function toggle(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (maxPicks != null && prev.length >= maxPicks) return prev
      return [...prev, id]
    })
  }

  const selectedContestants = selectedIds
    .map((id) => contestants.find((c) => c.id === id))
    .filter((c): c is Contestant => Boolean(c))

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-wrap gap-3">
        {contestants.map((c) => {
          const isSelected = selectedIds.includes(c.id)
          const taken = takenIds.includes(c.id) && !isSelected
          const out = eliminatedIds.includes(c.id) && !isSelected
          const blocked = (atLimit && !isSelected) || taken || out
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              aria-pressed={isSelected}
              disabled={blocked}
              title={out ? 'Eliminated from the show' : taken ? 'Already on another team' : blocked ? `Limit of ${maxPicks} picks reached \u2014 remove one first` : undefined}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-sm sm:text-base ${
                isSelected ? 'border-fuchsia-600 bg-fuchsia-50' : 'border-transparent'
              } ${blocked ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <ContestantPhoto url={c.photo_url} name={c.name} />
              <span>{c.name}</span>
              {taken && <span className="text-xs font-semibold text-zinc-500">Taken</span>}
              {out && <span className="text-xs font-semibold text-red-600">Out</span>}
              {isSelected && <input type="hidden" name="contestantId" value={c.id} />}
            </button>
          )
        })}
      </div>

      <div className="card w-full shrink-0 p-3 lg:w-64">
        <p className="mb-2 text-sm font-semibold text-zinc-700">
          Your picks ({selectedContestants.length}
          {maxPicks != null ? ` / ${maxPicks}` : ''})
        </p>
        {atLimit && <p className="mb-2 text-xs font-semibold text-amber-700">Pick limit reached — remove one to swap.</p>}
        {selectedContestants.length === 0 ? (
          <p className="text-sm text-zinc-400">Tap contestants to add them here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selectedContestants.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-2"
              >
                <ContestantPhoto url={c.photo_url} name={c.name} size="sm" />
                <span className="flex-1 text-sm font-medium">{c.name}</span>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="text-xs font-semibold text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
