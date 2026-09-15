-- Schema -------------------------------------------------------------------
create schema if not exists fantasy_tv;
set search_path to fantasy_tv, public;

-- Profiles ---------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger as $$
begin
  insert into fantasy_tv.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer set search_path = fantasy_tv, public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure fantasy_tv.handle_new_user();

create function is_admin() returns boolean as $$
  select exists (
    select 1 from fantasy_tv.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = fantasy_tv, public;

-- Shows / Seasons / Contestants / Episodes --------------------------------
create table shows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references shows(id) on delete cascade,
  name text not null,
  year int,
  created_at timestamptz not null default now()
);

create table contestants (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  name text not null,
  photo_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  episode_number int not null,
  air_date timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'aired', 'results_posted')),
  created_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

create table episode_events (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  event_type text not null,
  contestant_id uuid references contestants(id),
  description text,
  created_at timestamptz not null default now()
);

create table transcript_uploads (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  raw_text text not null,
  suggested_events jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  uploaded_by uuid references profiles(id),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Leagues ------------------------------------------------------------------
create table leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id),
  name text not null,
  format text not null check (format in ('bracket', 'weekly_vote')),
  scoring_config jsonb not null default '{}'::jsonb,
  join_code text not null unique,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create function is_league_member(p_league_id uuid) returns boolean as $$
  select exists (
    select 1 from fantasy_tv.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = fantasy_tv, public;

create function join_league_by_code(p_code text) returns uuid as $$
declare
  v_league_id uuid;
begin
  select id into v_league_id from fantasy_tv.leagues where join_code = p_code;
  if v_league_id is null then
    raise exception 'invalid join code';
  end if;
  insert into fantasy_tv.league_members (league_id, user_id)
  values (v_league_id, auth.uid())
  on conflict do nothing;
  return v_league_id;
end;
$$ language plpgsql security definer set search_path = fantasy_tv, public;

-- Weekly vote format ---------------------------------------------------------
create table weekly_questions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  episode_id uuid not null references episodes(id),
  question_text text not null,
  event_type_target text not null,
  point_value int not null default 1,
  lock_at timestamptz not null,
  resolved_at timestamptz,
  resolved_correct_contestant_id uuid references contestants(id),
  created_at timestamptz not null default now()
);

create table member_picks (
  id uuid primary key default gen_random_uuid(),
  weekly_question_id uuid not null references weekly_questions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  picked_contestant_id uuid not null references contestants(id),
  is_correct boolean,
  points_awarded int not null default 0,
  created_at timestamptz not null default now(),
  unique (weekly_question_id, user_id)
);

-- Bracket format -------------------------------------------------------------
create table bracket_matchups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  round int not null,
  matchup_index int not null,
  contestant_a_id uuid references contestants(id),
  contestant_b_id uuid references contestants(id),
  winner_id uuid references contestants(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (league_id, round, matchup_index)
);

create table member_bracket_picks (
  id uuid primary key default gen_random_uuid(),
  matchup_id uuid not null references bracket_matchups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  predicted_winner_id uuid not null references contestants(id),
  points_awarded int not null default 0,
  created_at timestamptz not null default now(),
  unique (matchup_id, user_id)
);

-- RLS --------------------------------------------------------------------
alter table profiles enable row level security;
alter table shows enable row level security;
alter table seasons enable row level security;
alter table contestants enable row level security;
alter table episodes enable row level security;
alter table episode_events enable row level security;
alter table transcript_uploads enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table weekly_questions enable row level security;
alter table member_picks enable row level security;
alter table bracket_matchups enable row level security;
alter table member_bracket_picks enable row level security;

create policy "profiles_select_own_or_admin" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());

create policy "content_select_all_authenticated" on shows for select using (auth.uid() is not null);
create policy "content_admin_write" on shows for all using (is_admin()) with check (is_admin());

create policy "seasons_select_all_authenticated" on seasons for select using (auth.uid() is not null);
create policy "seasons_admin_write" on seasons for all using (is_admin()) with check (is_admin());

create policy "contestants_select_all_authenticated" on contestants for select using (auth.uid() is not null);
create policy "contestants_admin_write" on contestants for all using (is_admin()) with check (is_admin());

create policy "episodes_select_all_authenticated" on episodes for select using (auth.uid() is not null);
create policy "episodes_admin_write" on episodes for all using (is_admin()) with check (is_admin());

create policy "episode_events_select_all_authenticated" on episode_events for select using (auth.uid() is not null);
create policy "episode_events_admin_write" on episode_events for all using (is_admin()) with check (is_admin());

create policy "transcript_uploads_admin_only" on transcript_uploads for all using (is_admin()) with check (is_admin());

create policy "leagues_select_member_or_admin" on leagues for select
  using (is_league_member(id) or is_admin());
create policy "leagues_admin_write" on leagues for all using (is_admin()) with check (is_admin());

create policy "league_members_select_own_or_admin" on league_members for select
  using (user_id = auth.uid() or is_admin());
create policy "league_members_admin_write" on league_members for all using (is_admin()) with check (is_admin());

create policy "weekly_questions_select_member_or_admin" on weekly_questions for select
  using (is_league_member(league_id) or is_admin());
create policy "weekly_questions_admin_write" on weekly_questions for all using (is_admin()) with check (is_admin());

create policy "member_picks_select_own_league_or_admin" on member_picks for select
  using (
    user_id = auth.uid() or is_admin() or
    exists (select 1 from weekly_questions wq where wq.id = weekly_question_id and is_league_member(wq.league_id))
  );
create policy "member_picks_insert_own_before_lock" on member_picks for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from weekly_questions wq
      where wq.id = weekly_question_id
        and is_league_member(wq.league_id)
        and wq.lock_at > now()
    )
  );
create policy "member_picks_update_own_before_lock" on member_picks for update
  using (
    user_id = auth.uid()
    and exists (select 1 from weekly_questions wq where wq.id = weekly_question_id and wq.lock_at > now())
  );
create policy "member_picks_admin_all" on member_picks for all using (is_admin()) with check (is_admin());

create policy "bracket_matchups_select_member_or_admin" on bracket_matchups for select
  using (is_league_member(league_id) or is_admin());
create policy "bracket_matchups_admin_write" on bracket_matchups for all using (is_admin()) with check (is_admin());

create policy "member_bracket_picks_select_own_league_or_admin" on member_bracket_picks for select
  using (
    user_id = auth.uid() or is_admin() or
    exists (select 1 from bracket_matchups bm where bm.id = matchup_id and is_league_member(bm.league_id))
  );
create policy "member_bracket_picks_insert_own" on member_bracket_picks for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from bracket_matchups bm
      where bm.id = matchup_id and is_league_member(bm.league_id) and bm.winner_id is null
    )
  );
create policy "member_bracket_picks_update_own" on member_bracket_picks for update
  using (
    user_id = auth.uid()
    and exists (select 1 from bracket_matchups bm where bm.id = matchup_id and bm.winner_id is null)
  );
create policy "member_bracket_picks_admin_all" on member_bracket_picks for all using (is_admin()) with check (is_admin());

-- Grants (RLS above still governs row-level access) ------------------------
grant usage on schema fantasy_tv to anon, authenticated;
grant all on all tables in schema fantasy_tv to anon, authenticated;
grant all on all sequences in schema fantasy_tv to anon, authenticated;
grant execute on all functions in schema fantasy_tv to anon, authenticated;
alter default privileges in schema fantasy_tv grant all on tables to anon, authenticated;

reset search_path;
