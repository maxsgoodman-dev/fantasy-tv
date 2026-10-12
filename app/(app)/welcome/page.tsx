import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league: leagueId } = await searchParams
  const supabase = await createClient()

  const { data: league } = leagueId
    ? await supabase.from('leagues').select('id, name, seasons(shows(name))').eq('id', leagueId).maybeSingle()
    : { data: null }
  const showName = (league?.seasons as unknown as { shows: { name: string } } | null)?.shows?.name

  const steps = [
    { title: 'Pick your team', body: 'Choose the contestants you think will go the distance.' },
    { title: 'Picks lock when the episode airs', body: 'Change your mind any time before then.' },
    { title: 'Score points and climb the board', body: 'Points roll in as the show unfolds. Beat your friends.' },
  ]

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
        {league ? 'Make my picks' : 'Go to my leagues'}
      </a>
    </div>
  )
}
