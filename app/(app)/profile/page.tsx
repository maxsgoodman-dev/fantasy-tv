import { createClient } from '@/lib/supabase/server'
import { updateDisplayName, uploadAvatar, updateLeagueName, uploadLeagueAvatar } from './actions'
import { Avatar } from '@/components/avatar'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user!.id)
    .single()

  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, display_name, avatar_url, leagues(name)')
    .eq('user_id', user!.id)

  return (
    <div className="flex max-w-xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Your profile</h1>
        <div className="flex items-center gap-4">
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={64} />
          <span className="font-semibold">{profile?.display_name}</span>
        </div>

        <form action={updateDisplayName} className="flex gap-2">
          <input
            name="displayName"
            defaultValue={profile?.display_name ?? ''}
            placeholder="Display name"
            required
            className="flex-1 rounded border p-2"
          />
          <button type="submit" className="rounded bg-fuchsia-600 px-4 text-sm font-semibold text-white">
            Save name
          </button>
        </form>

        <form action={uploadAvatar} className="flex flex-col gap-2">
          <input type="file" name="avatar" accept="image/*" required className="text-sm" />
          <button
            type="submit"
            className="w-fit rounded bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Upload avatar
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Your leagues</h2>
        <p className="text-sm text-zinc-600">
          Use a different nickname or avatar just for a specific league — leave blank to use your account
          default above.
        </p>
        {memberships?.length === 0 && <p className="text-zinc-600">You haven&apos;t joined any leagues yet.</p>}
        {memberships?.map((m) => {
          const league = m.leagues as unknown as { name: string } | null
          return (
            <div key={m.league_id} className="flex flex-col gap-3 rounded border p-4">
              <div className="flex items-center gap-3">
                <Avatar url={m.avatar_url ?? profile?.avatar_url} name={m.display_name ?? profile?.display_name} size={40} />
                <span className="font-semibold">{league?.name}</span>
              </div>

              <form
                key={`${m.league_id}:${m.display_name}`}
                action={updateLeagueName.bind(null, m.league_id)}
                className="flex gap-2"
              >
                <input
                  name="displayName"
                  defaultValue={m.display_name ?? ''}
                  placeholder={`League nickname (default: ${profile?.display_name ?? 'account name'})`}
                  className="flex-1 rounded border p-2 text-sm"
                />
                <button type="submit" className="rounded bg-fuchsia-600 px-3 text-sm font-semibold text-white">
                  Save
                </button>
              </form>

              <form action={uploadLeagueAvatar.bind(null, m.league_id)} className="flex items-center gap-2">
                <input type="file" name="avatar" accept="image/*" required className="text-xs" />
                <button type="submit" className="rounded bg-fuchsia-600 px-3 py-1 text-xs font-semibold text-white">
                  Upload league avatar
                </button>
              </form>
            </div>
          )
        })}
      </section>
    </div>
  )
}
