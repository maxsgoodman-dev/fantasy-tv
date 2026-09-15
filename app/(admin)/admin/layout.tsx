import { requireAdmin } from '@/lib/auth/require-admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div>
      <nav className="flex gap-4 border-b p-4">
        <a href="/admin/shows">Shows</a>
      </nav>
      <div className="p-4">{children}</div>
    </div>
  )
}
