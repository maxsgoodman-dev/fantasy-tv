import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { checkSource, type WikiSourceRow } from '@/lib/wiki/check-source'
import { resend, EMAIL_FROM } from '@/lib/email/resend'
import { wikiChangesEmail } from '@/lib/email/templates'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'fantasy_tv' } }
  )

  const { data: sources } = await supabase
    .from('show_wiki_sources')
    .select('id, season_id, url, parser, last_snapshot, shows(name)')
    .eq('enabled', true)

  const results: { sourceId: string; changed: boolean; eventCount: number; error?: string }[] = []

  for (const source of sources ?? []) {
    try {
      const { changed, eventCount } = await checkSource(supabase, source as WikiSourceRow)
      results.push({ sourceId: source.id, changed, eventCount })

      if (changed) {
        const showName = (source.shows as unknown as { name: string } | null)?.name ?? 'Show'
        const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
        const { data: userList } = await supabase.auth.admin.listUsers()
        const { subject, text } = wikiChangesEmail(showName, eventCount)
        for (const admin of admins ?? []) {
          const authUser = userList.users.find((u) => u.id === admin.id)
          if (!authUser?.email) continue
          await resend.emails.send({ from: EMAIL_FROM, to: authUser.email, subject, text })
        }
      }
    } catch (err) {
      results.push({ sourceId: source.id, changed: false, eventCount: 0, error: String(err) })
    }
  }

  return NextResponse.json({ results })
}
