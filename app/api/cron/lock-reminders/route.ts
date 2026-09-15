import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'
import { lockReminderEmail } from '@/lib/email/templates'
import { NextResponse } from 'next/server'

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

  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
  const ninetyMinutesFromNow = new Date(Date.now() + 90 * 60 * 1000)

  const { data: questions } = await supabase
    .from('weekly_questions')
    .select('id, question_text, lock_at, leagues(name, league_members(user_id))')
    .gt('lock_at', ninetyMinutesFromNow.toISOString())
    .lt('lock_at', twoHoursFromNow.toISOString())

  const { data: userEmails } = await supabase.auth.admin.listUsers()

  for (const q of questions ?? []) {
    const league = q.leagues as unknown as { name: string; league_members: { user_id: string }[] }
    for (const member of league.league_members) {
      const authUser = userEmails.users.find((u) => u.id === member.user_id)
      if (!authUser?.email) continue
      const { subject, text } = lockReminderEmail(league.name, q.question_text)
      await resend.emails.send({ from: 'Fantasy TV <notify@fantasytv.app>', to: authUser.email, subject, text })
    }
  }

  return NextResponse.json({ sent: questions?.length ?? 0 })
}
