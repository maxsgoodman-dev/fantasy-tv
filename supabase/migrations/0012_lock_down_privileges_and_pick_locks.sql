-- 0012: close a self-promote-to-admin hole and enforce pick locks in the database.
-- (Applied to production 2026-10-12 as three steps; this file is the combined, idempotent-safe record.)
--
-- 1) profiles_update_own / league_members_update_own only check row ownership, and
--    `authenticated` held UPDATE on every column. Any signed-in user could run
--    PATCH /rest/v1/profiles?id=eq.<me> {"role":"admin"}, or move their league_members
--    row to another league (skipping the join code). Restrict UPDATE to the columns the
--    app actually edits (display_name, avatar_url).
revoke update on fantasy_tv.profiles from anon, authenticated;
grant update (display_name, avatar_url) on fantasy_tv.profiles to authenticated;

revoke update on fantasy_tv.league_members from anon, authenticated;
grant update (display_name, avatar_url) on fantasy_tv.league_members to authenticated;

-- 2) Pick locks were enforced only in the server actions. Anyone with a session token can
--    call the REST API directly and change picks after an episode airs. Enforce the same
--    rules with RESTRICTIVE policies (ANDed with the existing permissive *_write_own
--    policies, so nothing is dropped). Admins are exempt.
--    Each lock is two restrictive policies: one for INSERT/UPDATE (WITH CHECK only, so SELECT
--    stays unrestricted and locked picks remain visible for scoring/leaderboards) and one for DELETE.
--    NOTE: DROP/DELETE through the Supabase MCP connector hang awaiting confirmation, hence additive policies.

-- Weekly lineups: writable only while the episode has not aired.
create policy weekly_lineups_lock_after_airing on fantasy_tv.weekly_lineups
  as restrictive for all to authenticated
  using (true)
  with check (
    fantasy_tv.is_admin()
    or exists (select 1 from fantasy_tv.episodes e where e.id = weekly_lineups.episode_id and e.air_date > now())
  );
create policy weekly_lineups_lock_delete on fantasy_tv.weekly_lineups
  as restrictive for delete to authenticated
  using (
    fantasy_tv.is_admin()
    or exists (select 1 from fantasy_tv.episodes e where e.id = weekly_lineups.episode_id and e.air_date > now())
  );

create policy weekly_lineup_picks_lock_after_airing on fantasy_tv.weekly_lineup_picks
  as restrictive for all to authenticated
  using (true)
  with check (
    fantasy_tv.is_admin()
    or exists (
      select 1 from fantasy_tv.weekly_lineups wl
      join fantasy_tv.episodes e on e.id = wl.episode_id
      where wl.id = weekly_lineup_picks.lineup_id and e.air_date > now()
    )
  );
create policy weekly_lineup_picks_lock_delete on fantasy_tv.weekly_lineup_picks
  as restrictive for delete to authenticated
  using (
    fantasy_tv.is_admin()
    or exists (
      select 1 from fantasy_tv.weekly_lineups wl
      join fantasy_tv.episodes e on e.id = wl.episode_id
      where wl.id = weekly_lineup_picks.lineup_id and e.air_date > now()
    )
  );

-- Season drafts: locked once episode 2 of the league's season has aired (matches saveDraft()).
create policy draft_picks_lock_after_ep2 on fantasy_tv.draft_picks
  as restrictive for all to authenticated
  using (true)
  with check (
    fantasy_tv.is_admin()
    or not exists (
      select 1 from fantasy_tv.leagues l
      join fantasy_tv.episodes e on e.season_id = l.season_id and e.episode_number = 2
      where l.id = draft_picks.league_id and e.air_date <= now()
    )
  );
create policy draft_picks_lock_delete on fantasy_tv.draft_picks
  as restrictive for delete to authenticated
  using (
    fantasy_tv.is_admin()
    or not exists (
      select 1 from fantasy_tv.leagues l
      join fantasy_tv.episodes e on e.season_id = l.season_id and e.episode_number = 2
      where l.id = draft_picks.league_id and e.air_date <= now()
    )
  );
