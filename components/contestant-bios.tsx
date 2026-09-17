'use client'

import { useState } from 'react'

type Contestant = {
  id: string
  name: string
  photo_url: string | null
  age: number | null
  location: string | null
  occupation: string | null
  bio: string | null
}

function BioPhoto({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-14 w-14 rounded-full object-cover" />
  }
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-200 text-xs text-zinc-500">
      No photo
    </div>
  )
}

export function ContestantBios({ contestants }: { contestants: Contestant[] }) {
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <section className="card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-xl font-bold">Contestant Bios</h2>
        <span className="text-sm text-zinc-500">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <ul className="mt-3 flex flex-col gap-1">
          {contestants.length === 0 && (
            <li className="text-sm text-zinc-500">No contestants for this season yet.</li>
          )}
          {contestants.map((c) => {
            const isExpanded = expandedId === c.id
            const hasBio = Boolean(c.bio || c.occupation || c.location || c.age)
            return (
              <li key={c.id} className="rounded border border-zinc-100">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left"
                >
                  <BioPhoto url={c.photo_url} name={c.name} />
                  <span className="flex-1">
                    <span className="block font-semibold">{c.name}</span>
                    {c.occupation && <span className="block text-xs text-zinc-500">{c.occupation}</span>}
                  </span>
                  <span className="text-sm text-zinc-400">{isExpanded ? '▲' : '▼'}</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-zinc-100 px-3 py-3 text-sm">
                    {!hasBio && <p className="text-zinc-500">Bio coming soon.</p>}
                    {hasBio && (
                      <>
                        <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                          {c.age && <span>Age {c.age}</span>}
                          {c.location && <span>{c.location}</span>}
                          {c.occupation && <span>{c.occupation}</span>}
                        </p>
                        {c.bio && <p className="text-zinc-700">{c.bio}</p>}
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
