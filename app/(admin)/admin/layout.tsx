import { requireAdmin } from '@/lib/auth/require-admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div>
      <nav className="flex flex-wrap items-center gap-4 border-b bg-zinc-50 p-4">
        <span className="font-bold text-fuchsia-700">Admin</span>
        <a href="/admin/shows" className="font-medium">
          Shows &amp; Seasons
        </a>
        <a href="/admin/leagues" className="font-medium">
          Leagues
        </a>
        <a href="/admin/leagues/new" className="font-medium">
          + New League
        </a>
        <a href="/dashboard" className="ml-auto font-medium">
          ← Back to app
        </a>
      </nav>
      <div className="p-4">{children}</div>
    </div>
  )
}
