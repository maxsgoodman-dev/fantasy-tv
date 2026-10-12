/**
 * Invite signups stash the league join code in the new user's metadata, because
 * when email confirmation is on there is no session yet to join with. Call this
 * once the user is signed in (right after signup, after confirming their email,
 * or after logging in): it joins the league and clears the stored code.
 * Returns the joined league id, or null if there was nothing to join.
 */
export async function joinPendingLeague(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const code = user?.user_metadata?.join_code
  if (!user || typeof code !== 'string' || !code) return null

  const { data: leagueId, error } = await supabase.rpc('join_league_by_code', { p_code: code.toUpperCase() })
  if (error || !leagueId) return null

  await supabase.auth.updateUser({ data: { join_code: null } })
  return leagueId as string
}
