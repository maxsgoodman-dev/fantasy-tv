import { createClient } from '@/lib/supabase/server'
import { toggleSource, checkSourceNow, approveWikiEvent, dismissWikiEvent } from './actions'
import { WikiSourceForm } from '@/components/wiki-source-form'
import type { SuggestedEvent } from '@/lib/wiki/types'

export const dynamic = 'force-dynamic'

export default async function WikiSourcesPage() {
  const supabase = await createClient()

  const { data: shows } = await supabase.from('shows').select('id, name, seasons(id, name)').order('name')

  const { data: sources } = await supabase
    .from('show_wiki_sources')
    .select(
      'id, url, parser, enabled, last_checked_at, last_changed_at, last_error, season_id, shows(name), seasons(name)'
    )
    .order('created_at', { ascending: false })

  const { data: ingestions } = await supabase
    .from('wiki_ingestions')
    .select('id, source_id, fetched_at, suggested_events, reviewed, status')
    .eq('status', 'pending')
    .order('fetched_at', { ascending: false })

  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]))

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Wiki Sources</h1>
      <p className="text-sm text-zinc-600">
        Watches a show&apos;s wiki page, diffs it against what it looked like last time, and queues
        matched scoring events here for approval — nothing posts to a league&apos;s scores until you
        approve it. Runs automatically once a day via cron, or hit &quot;Check now&quot; right after an
        episode airs for an immediate check. Fandom pages sit behind Cloudflare&apos;s bot challenge, so
        fetching them requires a <code className="rounded bg-zinc-100 px-1">SCRAPERAPI_KEY</code>{' '}
        environment variable (free tier at scraperapi.com covers this easily) — without it, checks against
        Fandom sources will fail with a 403.
      </p>

      <section className="card flex flex-col gap-4 p-4">
        <h2 className="text-xl font-bold">Add a source</h2>
        <WikiSourceForm
          shows={(shows ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            seasons: s.seasons as unknown as { id: string; name: string }[],
          }))}
        />
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <h2 className="text-xl font-bold">Sources</h2>
        {(!sources || sources.length === 0) && <p className="text-zinc-600">No sources yet.</p>}
        <ul className="flex flex-col gap-2">
          {sources?.map((s) => {
            const show = s.shows as unknown as { name: string } | null
            const season = s.seasons as unknown as { name: string } | null
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded border p-3 text-sm">
                <div className="flex-1">
                  <p className="font-semibold">
                    {show?.name} — {season?.name}
                  </p>
                  <p className="text-xs text-zinc-500">{s.url}</p>
                  <p className="text-xs text-zinc-500">
                    Last checked: {s.last_checked_at ? new Date(s.last_checked_at).toLocaleString() : 'never'}
                    {' · '}
                    Last changed: {s.last_changed_at ? new Date(s.last_changed_at).toLocaleString() : 'never'}
                  </p>
                  {s.last_error && <p className="text-xs font-semibold text-red-600">Error: {s.last_error}</p>}
                </div>
                <form action={checkSourceNow.bind(null, s.id)}>
                  <button type="submit" className="rounded bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white">
                    Check now
                  </button>
                </form>
                <form action={toggleSource.bind(null, s.id, !s.enabled)}>
                  <button
                    type="submit"
                    className={`rounded px-3 py-1.5 text-xs font-semibold ${
                      s.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {s.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card flex flex-col gap-4 p-4">
        <h2 className="text-xl font-bold">Pending review</h2>
        {(!ingestions || ingestions.length === 0) && (
          <p className="text-zinc-600">No wiki changes waiting for review.</p>
        )}
        {ingestions?.map((ing) => {
          const source = sourceById.get(ing.source_id)
          const show = source?.shows as unknown as { name: string } | null
          const events = ing.suggested_events as SuggestedEvent[]
          const reviewed = (ing.reviewed ?? {}) as Record<string, string>
          return (
            <div key={ing.id} className="rounded border p-3">
              <p className="mb-2 text-sm font-semibold">
                {show?.name} — fetched {new Date(ing.fetched_at).toLocaleString()}
              </p>
              <ul className="flex flex-col gap-1">
                {events.map((ev, i) => {
                  const outcome = reviewed[i]
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          ev.points >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {ev.kind === 'eliminated' ? 'OUT' : `${ev.points > 0 ? '+' : ''}${ev.points}`}
                      </span>
                      <span className="font-semibold">{ev.contestantName}</span>
                      <span className="text-zinc-600">
                        Ep. {ev.episodeNumber} · {ev.label}
                      </span>
                      {outcome ? (
                        <span className="text-xs text-zinc-400">{outcome}</span>
                      ) : (
                        <>
                          <form action={approveWikiEvent.bind(null, ing.id, i, source!.season_id!)}>
                            <button type="submit" className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                              Approve
                            </button>
                          </form>
                          <form action={dismissWikiEvent.bind(null, ing.id, i)}>
                            <button type="submit" className="rounded bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700">
                              Dismiss
                            </button>
                          </form>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}
