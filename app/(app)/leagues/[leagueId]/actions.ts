'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitPick(leagueId: string, questionId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const contestantId = String(formData.get('contestantId'))

  await supabase
    .from('member_picks')
    .upsert(
      { weekly_question_id: questionId, user_id: user!.id, picked_contestant_id: contestantId },
      { onConflict: 'weekly_question_id,user_id' }
    )

  revalidatePath(`/leagues/${leagueId}`)
}
