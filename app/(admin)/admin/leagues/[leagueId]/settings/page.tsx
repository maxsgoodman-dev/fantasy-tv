import { createClient } from '@/lib/supabase/server'
import { rulesetForShowName } from '@/lib/scoring/rulesets'
import { effectiveRules, readOverrides } from '@/lib/scoring/league-rules'
import { saveLeagueSettings, resetScoringToDefaults } from './actions'

export const dynamic = 'force-dynamic'

export default async function LeagueSettingsPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('name, format, max_picks, scoring_overrides, seasons(shows(name))')
    .eq('id', leagueId)
    .single()

  const showName = (league?.seasons as unknown as { shows: { name: string } } | null)?.shows?.name
  const rules = effectiveRules(rulesetForShowName(showName), readOverrides(league?.scoring_overrides))
  const categories = Array.from(new Set(rules.map((r) => r.category)))

  return (
    <div className="flex flex-col gap-6">
      <a href="/admin/leagues" className="text-sm underline">
        ← Leagues
      </a>
      <h1 className="text-2xl font-bold">{league?.name} — Settings</h1>

      <form action={saveLeagueSettings.bind(null, leagueId)} className="flex flex-col gap-6">
        <section className="card flex flex-col gap-2 p-4">
          <h2 className="text-xl font-bold">Pick limit</h2>
          <p className="text-sm text-zinc-600">
            The most contestants a member can select {league?.format === 'weekly_vote' ? 'each week' : 'in their draft'}.
            Leave blank for no limit.
          </p>
          <input
            name="maxPicks"
            type="number"
            min={1}
            defaultValue={league?.max_picks ?? ''}
            placeholder="No limit"
            className="w-32 rounded border p-2"
          />
        </section>

        <section className="card flex flex-col gap-4 p-4">
          <h2 className="text-xl font-bold">Scoring modifiers</h2>
          <p className="text-sm text-zinc-600">
            Change the points any rule is worth in this league. Changes apply to every logged event — past and
            future — for this league only. Modified values are highlighted; members see them in &quot;How
            scoring works&quot;.
          </p>
          {categories.map((category) => (
            <div key={category}>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">{category}</h3>
              <ul className="flex flex-col divide-y divide-zinc-100">
                {rules
                  .filter((r) => r.category === category)
                  .map((r) => (
                    <li key={r.code} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="flex-1">{r.label}</span>
                      <span className="text-xs text-zinc-400">default {r.basePoints}</span>
                      <input
                        name={`points_${r.code}`}
                        type="number"
                        step={1}
                        defaultValue={r.points}
                        className={`w-20 rounded border p-1.5 text-right ${r.modified ? 'border-amber-400 bg-amber-50' : ''}`}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>

        <button type="submit" className="w-fit rounded bg-fuchsia-600 px-5 py-2 font-semibold text-white">
          Save settings
        </button>
      </form>

      <form action={resetScoringToDefaults.bind(null, leagueId)}>
        <button type="submit" className="rounded bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700">
          Reset all scoring to show defaults
        </button>
      </form>
    </div>
  )
}
