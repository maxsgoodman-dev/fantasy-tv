import { createClient } from '@/lib/supabase/server'
import { JoinLeagueForm } from './join-league-form'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('league_members')
    .select('leagues(id, name, format)')
    .eq('user_id', user!.id)

  return (
    <div className="flex flex-col gap-6">
      <JoinLeagueForm />

      <ul className="flex flex-col gap-2">
        {memberships?.map((m) => {
          const league = m.leagues as unknown as { id: string; name: string; format: string }
          return (
            <li key={league.id}>
              <a className="underline" href={`/leagues/${league.id}`}>
                {league.name} ({league.format === 'bracket' ? 'Bracket' : 'Weekly vote'})
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
