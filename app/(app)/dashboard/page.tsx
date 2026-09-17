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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
                  className="relative flex h-56 items-end overflow-hidden"
                  style={{ backgroundColor: accent }}
                >
                  {show?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={show.image_url}
                      alt={show.name}
                      className="absolute inset-0 h-full w-full object-cover opacity-90"
                    />
                  )}
                  <div className="relative w-full bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4">
                    <p className="text-sm font-semibold uppercase tracking-wide text-white/90">
                      {show?.name}
                      {league.seasons?.year ? ` · ${league.seasons.year}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h3 className={`${fontClass} text-3xl leading-tight`} style={{ color: accent }}>
                    {league.name}
                  </h3>
                  <span
                    className="w-fit rounded-full px-3 py-1 text-sm font-semibold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {league.format === 'bracket' ? 'Season draft' : 'Weekly team'}
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
