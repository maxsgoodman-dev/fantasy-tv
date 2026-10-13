import { requireAdmin } from '@/lib/auth/require-admin'
import { DeleteButton } from '@/components/delete-button'
import { createTeam, addTeamEmails, removeTeamEmail, assignMember, deleteTeam, setTeamPicks } from './actions'

export const dynamic = 'force-dynamic'

type UserRow = {
  user_id: string
  email: string | null
  display_name: string | null
  email_confirmed_at: string | null
}

export default async function LeagueTeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ error?: string; ok?: string }>
}) {
  const { leagueId } = await params
  const { error, ok } = await searchParams
  const { supabase } = await requireAdmin()

  const { data: league } = await supabase
    .from('leagues')
    .select('name, join_code, format, season_id, max_picks')
    .eq('id', leagueId)
    .single()
  if (!league) return <p>League not found.</p>

  const [{ data: teams }, { data: invites }, { data: members }, { data: contestants }, { data: picks }, { data: usersRaw }] =
    await Promise.all([
      supabase.from('league_teams').select('id, name, draft_spot').eq('league_id', leagueId).order('draft_spot', { nullsFirst: false }),
      supabase.from('league_invites').select('id, email, team_id').eq('league_id', leagueId),
      supabase.from('league_members').select('user_id, team_id').eq('league_id', leagueId),
      supabase.from('contestants').select('id, name').eq('season_id', league.season_id).order('name'),
      supabase.from('draft_picks').select('team_id, contestant_id').eq('league_id', leagueId),
      supabase.rpc('admin_user_overview'),
    ])
  const users = (usersRaw ?? []) as unknown as UserRow[]
  const userByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]))
  const userById = new Map(users.map((u) => [u.user_id, u]))
  const memberIds = new Set((members ?? []).map((m) => m.user_id))
  const unassigned = (members ?? []).filter((m) => !m.team_id)
  const teamOfBaker = new Map((picks ?? []).map((p) => [p.contestant_id, p.team_id as string | null]))

  return (
    <div className="flex flex-col gap-6">
      <a href="/admin/leagues" className="text-sm underline">
        ← Leagues
      </a>
      <div>
        <h1 className="text-2xl font-bold">Teams — {league.name}</h1>
        <p className="text-sm text-zinc-600">
          Join code <span className="font-mono">{league.join_code}</span>. Everyone on a team shares one set of bakers and one
          line on the leaderboard. Add each person&apos;s email: when they sign up (or sign in) with that email and join with the code,
          they land on the right team automatically.
        </p>
        {league.format !== 'bracket' && (
          <p className="mt-2 rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-800">
            Teams are built for season-draft leagues. This league is a weekly-team league, so team grouping won&apos;t show on its page.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded border border-red-600 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok && !error && (
        <p role="status" className="rounded border border-green-600 bg-green-50 p-3 text-sm text-green-800">
          {ok}
        </p>
      )}

      {unassigned.length > 0 && (
        <section className="card flex flex-col gap-2 p-4">
          <h2 className="text-lg font-bold">Members not on a team</h2>
          <p className="text-sm text-zinc-600">They joined with an email that isn&apos;t on any team. Put them on one:</p>
          {unassigned.map((m) => {
            const u = userById.get(m.user_id)
            return (
              <form key={m.user_id} action={assignMember.bind(null, leagueId)} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="user_id" value={m.user_id} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {u?.display_name ?? 'Member'} <span className="font-normal text-zinc-600">{u?.email}</span>
                </span>
                <select name="team_id" required className="rounded border p-1 text-sm">
                  <option value="">Choose a team…</option>
                  {teams?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded bg-zinc-700 px-3 py-1 text-sm font-semibold text-white">
                  Assign
                </button>
              </form>
            )
          })}
        </section>
      )}

      {(teams ?? []).map((t) => {
        const teamInvites = (invites ?? []).filter((i) => i.team_id === t.id)
        const myPicks = new Set((picks ?? []).filter((p) => p.team_id === t.id).map((p) => p.contestant_id))
        return (
          <section key={t.id} className="card flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex-1 text-xl font-bold">
                {t.draft_spot ? `#${t.draft_spot} · ` : ''}
                {t.name}
              </h2>
              <form action={deleteTeam.bind(null, leagueId, t.id)}>
                <DeleteButton label="Delete team" confirmText={`Delete the team “${t.name}”? Its picks must be cleared first.`} />
              </form>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Emails on this team</h3>
              {teamInvites.length === 0 && <p className="text-sm text-zinc-600">No emails yet.</p>}
              {teamInvites.map((i) => {
                const u = userByEmail.get(i.email.toLowerCase())
                const joined = u && memberIds.has(u.user_id)
                return (
                  <form key={i.id} action={removeTeamEmail.bind(null, leagueId)} className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="invite_id" value={i.id} />
                    <span className="font-mono">{i.email}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        joined ? 'bg-green-100 text-green-800' : u ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {joined ? 'Joined' : u ? 'Has account, not in league yet' : 'No account yet'}
                    </span>
                    <button type="submit" className="text-xs text-zinc-500 underline">
                      remove
                    </button>
                  </form>
                )
              })}
              <form action={addTeamEmails.bind(null, leagueId, t.id)} className="mt-2 flex flex-wrap items-center gap-2">
                <input name="emails" placeholder="add emails (comma or space separated)" className="min-w-0 flex-1 rounded border p-2 text-sm" />
                <label className="flex items-center gap-1 text-xs text-zinc-600">
                  <input type="checkbox" name="send" /> email them the invite
                </label>
                <button type="submit" className="rounded bg-fuchsia-600 px-3 py-2 text-sm font-semibold text-white">
                  Add
                </button>
              </form>
            </div>

            <form action={setTeamPicks.bind(null, leagueId, t.id)} className="flex flex-col gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
                Bakers{league.max_picks ? ` (max ${league.max_picks})` : ''}
              </h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {(contestants ?? []).map((c) => {
                  const owner = teamOfBaker.get(c.id)
                  const takenElsewhere = owner !== undefined && owner !== t.id
                  return (
                    <label key={c.id} className={`flex items-center gap-1 text-sm ${takenElsewhere ? 'text-zinc-400' : ''}`}>
                      <input type="checkbox" name="contestantId" value={c.id} defaultChecked={myPicks.has(c.id)} disabled={takenElsewhere} />
                      {c.name}
                      {takenElsewhere && <span className="text-xs">(taken)</span>}
                    </label>
                  )
                })}
              </div>
              <button type="submit" className="w-fit rounded bg-zinc-700 px-3 py-1.5 text-sm font-semibold text-white">
                Save bakers
              </button>
            </form>
          </section>
        )
      })}

      <section className="card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">Add a team</h2>
        <form action={createTeam.bind(null, leagueId)} className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input name="name" required placeholder="Team name" className="min-w-0 flex-1 rounded border p-2" />
            <input name="draft_spot" type="number" min={1} placeholder="Draft spot" className="w-28 rounded border p-2" />
          </div>
          <textarea name="emails" rows={2} placeholder="Emails for this team (comma or space separated)" className="rounded border p-2" />
          <label className="flex items-center gap-1 text-sm text-zinc-600">
            <input type="checkbox" name="send" /> Email them the invite link
          </label>
          <button type="submit" className="w-fit rounded bg-fuchsia-600 px-4 py-2 font-semibold text-white">
            Create team
          </button>
        </form>
      </section>
    </div>
  )
}
