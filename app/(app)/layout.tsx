import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from './actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <header className="flex items-center justify-between bg-fuchsia-700 p-4 text-white">
        <span className="font-bold">Fantasy TV</span>
        <div className="flex items-center gap-4">
          <span>{profile?.display_name}</span>
          {profile?.role === 'admin' && <a href="/admin/shows">Admin</a>}
          <form action={logout}>
            <button type="submit">Log out</button>
          </form>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
