-- Read-only archive of past seasons (imported from external records, not
-- tracked live by the app's own episodes/contestants/scoring system).
create table fantasy_tv.show_history_seasons (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references fantasy_tv.shows(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table fantasy_tv.show_history_entries (
  id uuid primary key default gen_random_uuid(),
  history_season_id uuid not null references fantasy_tv.show_history_seasons(id) on delete cascade,
  baker_name text not null,
  team_name text,
  point_total int not null default 0,
  -- [{ "episode": 1, "points": 1, "status": null }, { "episode": 2, "points": null, "status": "X" }, ...]
  episode_points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table fantasy_tv.show_history_standings (
  id uuid primary key default gen_random_uuid(),
  history_season_id uuid not null references fantasy_tv.show_history_seasons(id) on delete cascade,
  team_name text not null,
  points int not null default 0,
  rank int,
  created_at timestamptz not null default now()
);

alter table fantasy_tv.show_history_seasons enable row level security;
alter table fantasy_tv.show_history_entries enable row level security;
alter table fantasy_tv.show_history_standings enable row level security;

create policy "show_history_seasons_select_all_authenticated" on fantasy_tv.show_history_seasons for select
  using (auth.uid() is not null);
create policy "show_history_seasons_admin_write" on fantasy_tv.show_history_seasons for all
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());

create policy "show_history_entries_select_all_authenticated" on fantasy_tv.show_history_entries for select
  using (auth.uid() is not null);
create policy "show_history_entries_admin_write" on fantasy_tv.show_history_entries for all
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());

create policy "show_history_standings_select_all_authenticated" on fantasy_tv.show_history_standings for select
  using (auth.uid() is not null);
create policy "show_history_standings_admin_write" on fantasy_tv.show_history_standings for all
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());
