import { createClient } from '@/lib/supabase/server'
import { joinExistingAndGo } from '../actions'
import { JoinForm } from './join-form'

export const dynamic = 'force-dynamic'

type Preview = {
  league_name: string
  show_name: string
  show_image_url: string | null
  theme_color: string | null
  member_count: number
}

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { code: rawCode } = await params
  const { error } = await searchParams
  const code = decodeURIComponent(rawCode).trim().toUpperCase().slice(0, 20)

  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    { data: preview },
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc('league_invite_preview', { p_code: code })])
  const league = (preview as Preview[] | null)?.[0] ?? null

  return (
    <div className="min-h-screen bg-gradient-to-b from-fuchsia-700 via-fuchsia-600 to-purple-700 px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-widest text-fuchsia-100">Fantasy TV</p>
          {league ? (
            <>
              <h1 className="mt-2 text-3xl font-black">You&apos;re invited!</h1>
              <div className="mt-4 flex flex-col items-center gap-2">
                {league.show_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={league.show_image_url} alt={league.show_name} className="h-24 w-40 rounded-lg object-cover shadow-lg" />
                )}
                <p className="text-xl font-bold">{league.league_name}</p>
                <p className="text-fuchsia-100">
                  {league.show_name} · {league.member_count} {league.member_count === 1 ? 'player' : 'players'} so far
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-2 text-3xl font-black">Join a league</h1>
              <p className="mt-2 text-fuchsia-100">
                We couldn&apos;t find a league for that link. Check the join code below, or ask your friend for a new link.
              </p>
            </>
          )}
        </div>

        {user ? (
          <div className="card flex flex-col gap-3 p-6">
            {error && (
              <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <p className="text-sm text-zinc-600">You&apos;re already signed in. Join this league with one tap.</p>
            <form action={joinExistingAndGo.bind(null, code)}>
              <button type="submit" className="w-full rounded-full bg-fuchsia-600 p-3 text-base font-semibold text-white">
                Join {league?.league_name ?? 'league'}
              </button>
            </form>
          </div>
        ) : (
          <JoinForm code={code} leagueName={league?.league_name ?? null} />
        )}
      </div>
    </div>
  )
}
