import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from './actions'
import { Avatar } from '@/components/avatar'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-4 bg-fuchsia-700 p-4 text-white">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="font-bold">
            Fantasy TV
          </a>
          <a href="/dashboard" className="font-medium">
            My Leagues
          </a>
        </div>
        <div className="flex items-center gap-4">
          <a href="/profile" className="flex items-center gap-2">
            <Avatar url={profile?.avatar_url} name={profile?.display_name} size={28} />
            <span>{profile?.display_name}</span>
          </a>
          {profile?.role === 'admin' && (
            <a
              href="/admin/shows"
              className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-fuchsia-700"
            >
              Admin
            </a>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="rounded-full border border-white/60 px-3 py-1 text-sm font-semibold"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
