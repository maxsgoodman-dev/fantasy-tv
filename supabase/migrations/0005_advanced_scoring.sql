-- Weekly team lineups (weekly_vote format): a member picks a small team of
-- contestants for each upcoming episode, replacing the old single-question
-- weekly_questions/member_picks mechanic.
create table fantasy_tv.weekly_lineups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fantasy_tv.leagues(id) on delete cascade,
  user_id uuid not null references fantasy_tv.profiles(id) on delete cascade,
  episode_id uuid not null references fantasy_tv.episodes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (league_id, user_id, episode_id)
);

create table fantasy_tv.weekly_lineup_picks (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references fantasy_tv.weekly_lineups(id) on delete cascade,
  contestant_id uuid not null references fantasy_tv.contestants(id),
  created_at timestamptz not null default now(),
  unique (lineup_id, contestant_id)
);

-- Granular scoring events an admin logs per contestant per episode (the
-- "did you see that" / "round table" / etc. rulebook). points is a snapshot
-- of that event's value at logging time, so a later change to the default
-- rule list doesn't retroactively alter history.
create table fantasy_tv.contestant_episode_events (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references fantasy_tv.episodes(id) on delete cascade,
  contestant_id uuid not null references fantasy_tv.contestants(id),
  event_code text not null,
  label text not null,
  points int not null,
  created_at timestamptz not null default now()
);

-- Season-long draft picks (bracket/"survival draft" format): each member
-- drafts a team once, locked before episode 2, and scores based on how many
-- elimination rounds each pick survives.
create table fantasy_tv.draft_picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fantasy_tv.leagues(id) on delete cascade,
  user_id uuid not null references fantasy_tv.profiles(id) on delete cascade,
  contestant_id uuid not null references fantasy_tv.contestants(id),
  created_at timestamptz not null default now(),
  unique (league_id, user_id, contestant_id)
);

alter table fantasy_tv.weekly_lineups enable row level security;
alter table fantasy_tv.weekly_lineup_picks enable row level security;
alter table fantasy_tv.contestant_episode_events enable row level security;
alter table fantasy_tv.draft_picks enable row level security;

create policy "weekly_lineups_select_league_or_admin" on fantasy_tv.weekly_lineups for select
  using (fantasy_tv.is_league_member(league_id) or fantasy_tv.is_admin());
create policy "weekly_lineups_write_own" on fantasy_tv.weekly_lineups for all
  using (user_id = auth.uid() and fantasy_tv.is_league_member(league_id))
  with check (user_id = auth.uid() and fantasy_tv.is_league_member(league_id));
create policy "weekly_lineups_admin_all" on fantasy_tv.weekly_lineups for all
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());

create policy "weekly_lineup_picks_select_league_or_admin" on fantasy_tv.weekly_lineup_picks for select
  using (
    fantasy_tv.is_admin()
    or exists (
      select 1 from fantasy_tv.weekly_lineups wl
      where wl.id = lineup_id and fantasy_tv.is_league_member(wl.league_id)
    )
  );
create policy "weekly_lineup_picks_write_own" on fantasy_tv.weekly_lineup_picks for all
  using (
    exists (select 1 from fantasy_tv.weekly_lineups wl where wl.id = lineup_id and wl.user_id = auth.uid())
  )
  with check (
    exists (select 1 from fantasy_tv.weekly_lineups wl where wl.id = lineup_id and wl.user_id = auth.uid())
  );
create policy "weekly_lineup_picks_admin_all" on fantasy_tv.weekly_lineup_picks for all
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());

create policy "contestant_episode_events_select_all_authenticated" on fantasy_tv.contestant_episode_events for select
  using (auth.uid() is not null);
create policy "contestant_episode_events_admin_write" on fantasy_tv.contestant_episode_events for all
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());

create policy "draft_picks_select_league_or_admin" on fantasy_tv.draft_picks for select
  using (fantasy_tv.is_league_member(league_id) or fantasy_tv.is_admin());
create policy "draft_picks_write_own" on fantasy_tv.draft_picks for all
  using (user_id = auth.uid() and fantasy_tv.is_league_member(league_id))
  with check (user_id = auth.uid() and fantasy_tv.is_league_member(league_id));
create policy "draft_picks_admin_all" on fantasy_tv.draft_picks for all
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());
