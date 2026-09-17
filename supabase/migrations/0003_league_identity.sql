-- Per-league nickname/avatar overrides. NULL means "use the account default"
-- (fantasy_tv.profiles.display_name / avatar_url).
alter table fantasy_tv.league_members
  add column display_name text,
  add column avatar_url text;

-- Members could already SELECT their own league_members row (own_or_admin
-- policy), but there was no UPDATE policy for a non-admin member — only
-- admins could write to this table. Add one scoped to the member's own row.
create policy "league_members_update_own" on fantasy_tv.league_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
