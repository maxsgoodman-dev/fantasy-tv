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

  // Hobby-plan Vercel Cron only allows a daily schedule, so this runs once a day
  // (see vercel.json) rather than every 30 minutes. To still catch anything locking
  // before the next run, the window is widened to "locks sometime in the next 24
  // hours" instead of a precise "locks in ~2 hours" check.
  const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const { data: questions } = await supabase
    .from('weekly_questions')
    .select('id, question_text, lock_at, leagues(name, league_members(user_id))')
    .gt('lock_at', new Date().toISOString())
    .lt('lock_at', twentyFourHoursFromNow.toISOString())

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
