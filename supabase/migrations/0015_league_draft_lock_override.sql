-- 0015: per-league draft lock time. NULL keeps the old rule (locks when Episode 2 airs).
-- Lets a league that starts its draft late (after Ep 2) set its own deadline.
-- Applied to production 2026-10-12; Bake Off leagues set to lock 2026-10-13 12:00 UTC.
alter table fantasy_tv.leagues add column draft_locks_at timestamptz;

create function fantasy_tv.draft_is_locked(p_league_id uuid) returns boolean
language sql stable security definer set search_path = fantasy_tv, public as $$
  select coalesce(
    (select l.draft_locks_at <= now() from fantasy_tv.leagues l where l.id = p_league_id and l.draft_locks_at is not null),
    exists (
      select 1 from fantasy_tv.leagues l
      join fantasy_tv.episodes e on e.season_id = l.season_id and e.episode_number = 2
      where l.id = p_league_id and e.air_date <= now()
    )
  );
$$;
revoke all on function fantasy_tv.draft_is_locked(uuid) from public, anon;
grant execute on function fantasy_tv.draft_is_locked(uuid) to authenticated;

alter policy draft_picks_lock_after_ep2 on fantasy_tv.draft_picks
  with check (fantasy_tv.is_admin() or not fantasy_tv.draft_is_locked(league_id));
alter policy draft_picks_lock_delete on fantasy_tv.draft_picks
  using (fantasy_tv.is_admin() or not fantasy_tv.draft_is_locked(league_id));
