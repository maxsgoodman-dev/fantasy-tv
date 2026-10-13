import { requireAdmin } from '@/lib/auth/require-admin'
import { DeleteButton } from '@/components/delete-button'
import { inviteByEmail, resendInvite, deleteInvite } from './actions'

export const dynamic = 'force-dynamic'

type UserRow = {
  user_id: string
  email: string | null
  display_name: string | null
  role: string | null
  signed_up_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  pending_join_code: string | null
  leagues: { league_id: string; name: string; joined_at: string }[]
}

type InviteRow = {
  id: string
  email: string
  created_at: string
  last_sent_at: string
  league_id: string
  leagues: { name: string } | null
  league_teams: { name: string } | null
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function Badge({ tone, children }: { tone: 'green' | 'amber' | 'zinc'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    zinc: 'bg-zinc-100 text-zinc-700',
  }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>
}

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const { error, sent } = await searchParams
  const { supabase } = await requireAdmin()

  const [{ data: leagues }, { data: invitesRaw }, { data: usersRaw, error: usersError }] = await Promise.all([
    supabase.from('leagues').select('id, name, join_code').order('name'),
    supabase
      .from('league_invites')
      .select('id, email, created_at, last_sent_at, league_id, leagues(name), league_teams(name)')
      .order('created_at', { ascending: false }),
    supabase.rpc('admin_user_overview'),
  ])
  const invites = (invitesRaw ?? []) as unknown as InviteRow[]
  const users = (usersRaw ?? []) as unknown as UserRow[]
  const byEmail = new Map(users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]))
  const invitedEmails = new Set(invites.map((i) => i.email.toLowerCase()))

  const status = (inv: InviteRow) => {
    const u = byEmail.get(inv.email.toLowerCase())
    if (!u) return { tone: 'zinc' as const, label: 'Invited — no account yet', detail: '' }
    if (u.leagues.some((l) => l.league_id === inv.league_id)) {
      const m = u.leagues.find((l) => l.league_id === inv.league_id)!
      return { tone: 'green' as const, label: 'Joined', detail: fmt(m.joined_at) }
    }
    if (!u.email_confirmed_at)
      return { tone: 'amber' as const, label: 'Signed up — email not confirmed', detail: fmt(u.signed_up_at) }
    return { tone: 'amber' as const, label: 'Has account, not in this league', detail: fmt(u.signed_up_at) }
  }

  const joinedCount = invites.filter((i) => status(i).label === 'Joined').length
  const others = users.filter((u) => !u.email || !invitedEmails.has(u.email.toLowerCase()))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">User invites</h1>
        <p className="text-sm text-zinc-600">
          {invites.length} invited · {joinedCount} joined · {users.length} total accounts
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded border border-red-600 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {sent && !error && (
        <p role="status" className="rounded border border-green-600 bg-green-50 p-3 text-sm text-green-800">
          {Number(sent) === 1 ? 'Invite sent.' : `${sent} invites sent.`}
        </p>
      )}
      {usersError && (
        <p role="alert" className="rounded border border-red-600 bg-red-50 p-3 text-sm text-red-700">
          Couldn&apos;t load accounts: {usersError.message}
        </p>
      )}

      <section className="card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">Invite by email</h2>
        <form action={inviteByEmail} className="flex flex-col gap-3">
          <select name="league_id" required className="rounded border p-2">
            <option value="">Choose a league…</option>
            {leagues?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.join_code})
              </option>
            ))}
          </select>
          <textarea
            name="emails"
            required
            rows={3}
            placeholder="friend@example.com, another@example.com (separate with commas, spaces or new lines)"
            className="rounded border p-2"
          />
          <button type="submit" className="self-start rounded bg-fuchsia-600 px-4 py-2 font-semibold text-white">
            Send invites
          </button>
        </form>
        <p className="text-xs text-zinc-500">
          Each person gets an email with a link that takes them straight to a quick signup. You can also just share a
          league&apos;s link from its page &mdash; people who join that way show up under &ldquo;Other accounts&rdquo; below.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Invites sent</h2>
        {invites.length === 0 && <p className="text-zinc-600">No email invites yet.</p>}
        <ul className="flex flex-col gap-2">
          {invites.map((inv) => {
            const s = status(inv)
            const u = byEmail.get(inv.email.toLowerCase())
            return (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded border p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{inv.email}</div>
                  <div className="text-sm text-zinc-600">
                    {inv.leagues?.name ?? 'League'}{inv.league_teams ? ` · team: ${inv.league_teams.name}` : ''} · invited {fmt(inv.created_at)}
                    {inv.last_sent_at !== inv.created_at && ` · last sent ${fmt(inv.last_sent_at)}`}
                  </div>
                  {u && u.leagues.length > 0 && (
                    <div className="text-sm text-zinc-600">
                      {u.display_name ? `${u.display_name} · ` : ''}In: {u.leagues.map((l) => l.name).join(', ')}
                    </div>
                  )}
                </div>
                <Badge tone={s.tone}>
                  {s.label}
                  {s.detail && ` · ${s.detail}`}
                </Badge>
                {s.label !== 'Joined' && (
                  <form action={resendInvite}>
                    <input type="hidden" name="invite_id" value={inv.id} />
                    <button type="submit" className="rounded bg-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700">
                      Resend
                    </button>
                  </form>
                )}
                <form action={deleteInvite}>
                  <input type="hidden" name="invite_id" value={inv.id} />
                  <DeleteButton label="Remove" confirmText={`Remove the invite for ${inv.email}? This doesn't affect their account.`} />
                </form>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Other accounts</h2>
        <p className="text-sm text-zinc-600">Everyone who signed up without an email invite from here (shared link, join code, etc.).</p>
        {others.length === 0 && <p className="text-zinc-600">Nobody yet.</p>}
        <ul className="flex flex-col gap-2">
          {others.map((u) => (
            <li key={u.user_id} className="flex flex-wrap items-center gap-3 rounded border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {u.display_name ?? '—'} <span className="font-normal text-zinc-600">{u.email}</span>
                  {u.role === 'admin' && <span className="ml-2"><Badge tone="zinc">admin</Badge></span>}
                </div>
                <div className="text-sm text-zinc-600">
                  Signed up {fmt(u.signed_up_at)} · last sign-in {fmt(u.last_sign_in_at)}
                </div>
                <div className="text-sm text-zinc-600">
                  {u.leagues.length > 0 ? `In: ${u.leagues.map((l) => l.name).join(', ')}` : 'Not in any league'}
                </div>
              </div>
              {!u.email_confirmed_at && <Badge tone="amber">Email not confirmed</Badge>}
              {u.pending_join_code && u.leagues.length === 0 && (
                <Badge tone="amber">Waiting to join {u.pending_join_code}</Badge>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
