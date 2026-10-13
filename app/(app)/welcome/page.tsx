import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Step = { title: string; body: string }

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league: leagueId } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: league } = leagueId
    ? await supabase.from('leagues').select('id, name, format, seasons(shows(name))').eq('id', leagueId).maybeSingle()
    : { data: null }
  const showName = (league?.seasons as unknown as { shows: { name: string } } | null)?.shows?.name

  // Team leagues (the in-person season draft): the draft is already done, so the welcome is
  // "here is your team", not "go make your picks".
  const { data: teams } = league
    ? await supabase.from('league_teams').select('id, name').eq('league_id', league.id)
    : { data: null }
  const teamLeague = (teams ?? []).length > 0
  const { data: membership } =
    league && user
      ? await supabase.from('league_members').select('team_id').eq('league_id', league.id).eq('user_id', user.id).maybeSingle()
      : { data: null }
  const myTeam = (teams ?? []).find((t) => t.id === membership?.team_id) ?? null

  let steps: Step[]
  let cta = league ? 'Make my picks' : 'Go to my leagues'
  let subtitle: string | null = null

  if (league && teamLeague) {
    const { data: picks } = myTeam
      ? await supabase
          .from('draft_picks')
          .select('contestants(name)')
          .eq('league_id', league.id)
          .eq('team_id', myTeam.id)
      : { data: [] }
    const bakers = (picks ?? [])
      .map((p) => (p.contestants as unknown as { name: string } | null)?.name)
      .filter(Boolean) as string[]
    const { data: locked } = await supabase.rpc('draft_is_locked', { p_league_id: league.id })

    cta = 'See the leaderboard'
    subtitle = myTeam ? `You're on team ${myTeam.name}.` : null
    steps = myTeam
      ? [
          {
            title: 'Your team is set',
            body: bakers.length
              ? `Your bakers: ${bakers.join(', ')}. Everyone on your team shares the same bakers and the same score.`
              : 'Your bakers are being added. Everyone on your team shares the same bakers and the same score.',
          },
          {
            title: locked ? 'The draft is done and locked' : 'The draft is done',
            body: 'Picks were made in person, one team per baker. There is nothing to pick on the site.',
          },
          {
            title: 'Watch the leaderboard',
            body: 'Points are added after each episode, starting with Episode 3. The team standings and every baker’s points update right away.',
          },
        ]
      : [
          {
            title: 'You’re in the league, but not on a team yet',
            body: 'You signed up with an email that isn’t on a team. Tell the league organizer which team you’re on and they’ll add you.',
          },
          {
            title: 'The draft is done',
            body: 'Picks were made in person, so there is nothing to pick on the site.',
          },
          {
            title: 'You can still follow along',
            body: 'The leaderboard shows every team, every baker, and the points as they come in.',
          },
        ]
  } else {
    steps = [
      { title: 'Pick your team', body: 'Choose the contestants you think will go the distance.' },
      { title: 'Picks lock when the episode airs', body: 'Change your mind any time before then.' },
      { title: 'Score points and climb the board', body: 'Points roll in as the show unfolds. Beat your friends.' },
    ]
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="text-center">
        <h1 className="text-3xl font-black">Welcome to the league!</h1>
        {league && (
          <p className="mt-2 text-zinc-600">
            You&apos;re in <strong>{league.name}</strong>
            {showName ? ` (${showName})` : ''}.
          </p>
        )}
        {subtitle && <p className="mt-1 font-semibold text-fuchsia-700 dark:text-fuchsia-300">{subtitle}</p>}
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card flex items-start gap-3 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 font-bold text-white">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{s.title}</p>
              <p className="text-sm text-zinc-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <a
        href={league ? `/leagues/${league.id}` : '/dashboard'}
        className="rounded-full bg-fuchsia-600 p-3 text-center text-base font-semibold text-white"
      >
        {cta}
      </a>
    </div>
  )
}
