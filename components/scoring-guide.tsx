import type { EffectiveRule } from '@/lib/scoring/league-rules'

/**
 * "How scoring works" — a native <details> so it needs no client JS. Shows
 * this league's *effective* point values, flagging any the admin changed
 * from the show's defaults.
 */
export function ScoringGuide({
  rules,
  format,
  maxPicks,
}: {
  rules: EffectiveRule[]
  format: 'weekly_vote' | 'bracket' | string
  maxPicks: number | null
}) {
  const categories = Array.from(new Set(rules.map((r) => r.category)))
  const modifiedCount = rules.filter((r) => r.modified).length

  return (
    <details className="card p-4">
      <summary className="flex cursor-pointer items-center justify-between text-xl font-bold">
        <span>How scoring works</span>
        {modifiedCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            {modifiedCount} custom value{modifiedCount === 1 ? '' : 's'}
          </span>
        )}
      </summary>

      <div className="mt-3 flex flex-col gap-4 text-sm">
        <p className="text-zinc-600">
          {format === 'weekly_vote'
            ? `Pick your team before each episode airs${maxPicks ? ` (up to ${maxPicks} contestants)` : ''}. Picks lock when the episode airs, and your team earns the points its contestants score in that episode. Your total is the sum across all episodes.`
            : `Draft your team once${maxPicks ? ` (up to ${maxPicks} contestants)` : ''} before the draft locks. Your team earns points from every episode all season, so early picks that last are worth the most.`}
        </p>

        {categories.map((category) => (
          <div key={category}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">{category}</h3>
            <ul className="flex flex-col divide-y divide-zinc-100">
              {rules
                .filter((r) => r.category === category)
                .map((r) => (
                  <li key={r.code} className="flex items-center justify-between gap-3 py-1.5">
                    <span>{r.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.modified && <span className="text-xs text-zinc-400 line-through">{r.basePoints}</span>}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          r.points >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        } ${r.modified ? 'ring-2 ring-amber-300' : ''}`}
                      >
                        {r.points > 0 ? '+' : ''}
                        {r.points}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  )
}
