import { createClient } from '@/lib/supabase/server'
import { JoinLeagueForm } from './join-league-form'

export const dynamic = 'force-dynamic'

type ShowBranding = {
  name: string
  image_url: string | null
  theme_color: string
  theme_font: 'bold' | 'playful'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('league_members')
    .select(
      'leagues(id, name, format, seasons(name, year, shows(name, image_url, theme_color, theme_font)))'
    )
    .eq('user_id', user!.id)

  return (
    <div className="flex flex-col gap-8">
      <div className="card p-4">
        <h1 className="mb-3 text-xl font-bold">Join a league</h1>
        <JoinLeagueForm />
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold">My Leagues</h2>
        {memberships?.length === 0 && (
          <p className="text-zinc-600">You haven&apos;t joined any leagues yet — enter a join code above.</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships?.map((m) => {
            const league = m.leagues as unknown as {
              id: string
              name: string
              format: string
              seasons: { name: string; year: number | null; shows: ShowBranding } | null
            }
            const show = league.seasons?.shows
            const accent = show?.theme_color ?? '#a21caf'
            const fontClass = show?.theme_font === 'playful' ? 'font-theme-playful' : 'font-theme-bold'

            return (
              <a
                key={league.id}
                href={`/leagues/${league.id}`}
                className="card group flex flex-col overflow-hidden transition-transform hover:-translate-y-0.5"
                style={{ borderColor: accent }}
              >
                <div
                  className="relative flex h-32 items-end overflow-hidden"
                  style={{ backgroundColor: accent }}
                >
                  {show?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={show.image_url}
                      alt={show.name}
                      className="absolute inset-0 h-full w-full object-cover opacity-60"
                    />
                  )}
                  <div
                    className="relative w-full bg-gradient-to-t from-black/70 to-transparent p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                      {show?.name}
                      {league.seasons?.year ? ` · ${league.seasons.year}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className={`${fontClass} text-2xl leading-tight`} style={{ color: accent }}>
                    {league.name}
                  </h3>
                  <span
                    className="w-fit rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {league.format === 'bracket' ? 'Bracket' : 'Weekly vote'}
                  </span>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
