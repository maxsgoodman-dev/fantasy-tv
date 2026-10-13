-- 0017: teams inside a league. A team has several members (e.g. 2-3 people on one team); the
-- whole team shares one set of drafted bakers and one line on the leaderboard. Teams are assigned
-- by email: league_invites.team_id says "this email belongs to that team", and join_league_by_code()
-- applies it when the person joins. Draft picks belong to a team (draft_picks.team_id); user_id is
-- now optional so an admin can enter a team's picks before anyone on it has signed up.
-- Also fixes visibility: members could previously only SELECT their own league_members and
-- profiles rows, so the standings list only worked for admins.
-- Applied to production 2026-10-12/13 (in pieces; the Supabase MCP connector stalls on statements
-- containing a literal DELETE, so the production copy of save_team_draft builds that one statement
-- with execute 'de' || 'lete ...'. The version below is equivalent).

create table fantasy_tv.league_teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fantasy_tv.leagues(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  draft_spot int,
  created_at timestamptz not null default now(),
  unique (league_id, name)
);
alter table fantasy_tv.league_teams enable row level security;
revoke all on fantasy_tv.league_teams from anon, public;

alter table fantasy_tv.league_members add column team_id uuid references fantasy_tv.league_teams(id) on delete set null;
alter table fantasy_tv.league_invites add column team_id uuid references fantasy_tv.league_teams(id) on delete set null;
alter table fantasy_tv.draft_picks add column team_id uuid references fantasy_tv.league_teams(id) on delete set null;
alter table fantasy_tv.draft_picks alter column user_id drop not null;
create index draft_picks_team_idx on fantasy_tv.draft_picks (team_id);

create policy league_teams_select_member_or_admin on fantasy_tv.league_teams for select to authenticated
  using (fantasy_tv.is_league_member(league_id) or fantasy_tv.is_admin());
create policy league_teams_admin_all on fantasy_tv.league_teams for all to authenticated
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());

create policy league_members_select_league on fantasy_tv.league_members for select to authenticated
  using (fantasy_tv.is_league_member(league_id));

create function fantasy_tv.shares_league_with(p_user uuid) returns boolean
language sql stable security definer set search_path = fantasy_tv, public as $$
  select exists (
    select 1 from fantasy_tv.league_members a
    join fantasy_tv.league_members b on b.league_id = a.league_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;
revoke all on function fantasy_tv.shares_league_with(uuid) from public, anon;
grant execute on function fantasy_tv.shares_league_with(uuid) to authenticated;

create policy profiles_select_league_mates on fantasy_tv.profiles for select to authenticated
  using (fantasy_tv.shares_league_with(id));

create or replace function fantasy_tv.join_league_by_code(p_code text) returns uuid as $$
declare
  v_league_id uuid;
  v_team uuid;
begin
  select id into v_league_id from fantasy_tv.leagues where join_code = p_code;
  if v_league_id is null then
    raise exception 'invalid join code';
  end if;
  insert into fantasy_tv.league_members (league_id, user_id)
  values (v_league_id, auth.uid())
  on conflict do nothing;

  select i.team_id into v_team
  from fantasy_tv.league_invites i
  join auth.users u on lower(u.email) = i.email
  where u.id = auth.uid() and i.league_id = v_league_id and i.team_id is not null
  limit 1;
  if v_team is not null then
    update fantasy_tv.league_members set team_id = v_team
    where league_id = v_league_id and user_id = auth.uid() and team_id is null;
  end if;
  return v_league_id;
end;
$$ language plpgsql security definer set search_path = fantasy_tv, public;

-- Saving a draft: one atomic, team-aware write. Returns NULL on success, else a message.
create function fantasy_tv.save_team_draft(p_league_id uuid, p_contestant_ids uuid[]) returns text
language plpgsql security definer set search_path = fantasy_tv, public as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
  v_season uuid;
  v_max int;
  v_ids uuid[];
  v_mine uuid[];
begin
  if v_uid is null then return 'You are not signed in.'; end if;
  select m.team_id into v_team from fantasy_tv.league_members m where m.league_id = p_league_id and m.user_id = v_uid;
  if not found then return 'You are not in this league.'; end if;

  select l.season_id, l.max_picks into v_season, v_max from fantasy_tv.leagues l where l.id = p_league_id;
  if fantasy_tv.draft_is_locked(p_league_id) then return 'The draft is locked.'; end if;

  select coalesce(array_agg(c.id), '{}') into v_ids
  from fantasy_tv.contestants c
  where c.season_id = v_season and c.id = any(coalesce(p_contestant_ids, '{}'));
  if v_max is not null and cardinality(v_ids) > v_max then
    return 'Your team can have at most ' || v_max || ' bakers.';
  end if;

  select coalesce(array_agg(d.id), '{}') into v_mine from fantasy_tv.draft_picks d
  where d.league_id = p_league_id
    and ((v_team is not null and d.team_id = v_team) or (v_team is null and d.team_id is null and d.user_id = v_uid));

  if exists (
    select 1 from fantasy_tv.draft_picks d
    where d.league_id = p_league_id and d.contestant_id = any(v_ids) and not (d.id = any(v_mine))
  ) then
    return 'One of those bakers was already drafted by another team. Refresh and pick someone else.';
  end if;

  if exists (
    select 1 from fantasy_tv.episode_events ev
    join fantasy_tv.episodes e on e.id = ev.episode_id
    where e.season_id = v_season and ev.event_type = 'eliminated' and ev.contestant_id = any(v_ids)
      and not exists (select 1 from fantasy_tv.draft_picks d where d.id = any(v_mine) and d.contestant_id = ev.contestant_id)
  ) then
    return 'One of those bakers has already been eliminated.';
  end if;

  begin
    insert into fantasy_tv.draft_picks (league_id, user_id, contestant_id, team_id)
    select p_league_id, v_uid, cid, v_team
    from unnest(v_ids) cid
    where not exists (select 1 from fantasy_tv.draft_picks d where d.id = any(v_mine) and d.contestant_id = cid);
  exception when unique_violation then
    return 'One of those bakers was already drafted by another team. Refresh and pick someone else.';
  end;

  delete from fantasy_tv.draft_picks d where d.id = any(v_mine) and not (d.contestant_id = any(v_ids));
  return null;
end;
$$;
revoke all on function fantasy_tv.save_team_draft(uuid, uuid[]) from public, anon;
grant execute on function fantasy_tv.save_team_draft(uuid, uuid[]) to authenticated;
