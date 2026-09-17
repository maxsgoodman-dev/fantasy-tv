import { requireAdmin } from '@/lib/auth/require-admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div>
      <nav className="flex flex-wrap items-center gap-4 border-b-2 border-fuchsia-200 bg-white p-4 shadow-sm">
        <span className="rounded-full bg-fuchsia-700 px-3 py-1 text-sm font-bold text-white">Admin</span>
        <a href="/admin/shows" className="font-medium text-zinc-700 hover:text-fuchsia-700">
          Shows &amp; Seasons
        </a>
        <a href="/admin/leagues" className="font-medium text-zinc-700 hover:text-fuchsia-700">
          Leagues
        </a>
        <a href="/admin/leagues/new" className="font-medium text-zinc-700 hover:text-fuchsia-700">
          + New League
        </a>
        <a href="/admin/wiki-sources" className="font-medium text-zinc-700 hover:text-fuchsia-700">
          Wiki Sources
        </a>
        <a href="/dashboard" className="ml-auto font-medium text-zinc-700 hover:text-fuchsia-700">
          ← Back to app
        </a>
      </nav>
      <div className="mx-auto max-w-5xl p-4">{children}</div>
    </div>
  )
}
