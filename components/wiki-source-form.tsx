'use client'

import { useState } from 'react'
import { addSource } from '@/app/(admin)/admin/wiki-sources/actions'

type Show = { id: string; name: string; seasons: { id: string; name: string }[] }

export function WikiSourceForm({ shows }: { shows: Show[] }) {
  const options = shows.flatMap((show) =>
    show.seasons.map((season) => ({
      value: `${show.id}|${season.id}`,
      label: `${show.name} — ${season.name}`,
      showId: show.id,
      seasonId: season.id,
    }))
  )
  const [selected, setSelected] = useState(options[0]?.value ?? '')
  const current = options.find((o) => o.value === selected)

  return (
    <form action={addSource} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-sm">
        Show / Season
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded border p-2"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="showId" value={current?.showId ?? ''} />
      <input type="hidden" name="seasonId" value={current?.seasonId ?? ''} />
      <label className="flex flex-col text-sm">
        Parser
        <select name="parser" required className="rounded border p-2">
          <option value="bakeoff_wiki">Bake Off wiki (episode-grid table)</option>
          <option value="traitors_wiki">Traitors wiki (contestant/result table)</option>
        </select>
      </label>
      <label className="flex flex-1 flex-col text-sm">
        Wiki URL
        <input
          name="url"
          type="url"
          required
          placeholder="https://gbbo.fandom.com/wiki/The_Great_British_Bake_Off_(Series_17)"
          className="rounded border p-2"
        />
      </label>
      <button type="submit" className="rounded bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white">
        Add source
      </button>
    </form>
  )
}
