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

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, episode_number, air_date, season_id')
    .gt('air_date', new Date().toISOString())
    .lt('air_date', twentyFourHoursFromNow.toISOString())

  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, name, format, season_id, league_members(user_id)')

  const { data: userEmails } = await supabase.auth.admin.listUsers()

  let sent = 0
  for (const ep of episodes ?? []) {
    // weekly_vote leagues care about every episode (a new lineup lock each
    // week); bracket/draft leagues only care about Episode 2, which is when
    // the season-long draft itself locks.
    const relevantLeagues = (leagues ?? []).filter((l) => {
      if (l.season_id !== ep.season_id) return false
      if (l.format === 'weekly_vote') return true
      return l.format === 'bracket' && ep.episode_number === 2
    })

    for (const league of relevantLeagues) {
      const members = league.league_members as unknown as { user_id: string }[]
      for (const member of members) {
        const authUser = userEmails.users.find((u) => u.id === member.user_id)
        if (!authUser?.email) continue
        const message =
          league.format === 'bracket'
            ? `Your season draft locks before Episode ${ep.episode_number} airs`
            : `Set your team for Episode ${ep.episode_number}`
        const { subject, text } = lockReminderEmail(league.name, message)
        await resend.emails.send({ from: 'Fantasy TV <notify@fantasytv.app>', to: authUser.email, subject, text })
        sent++
      }
    }
  }

  return NextResponse.json({ sent })
}
