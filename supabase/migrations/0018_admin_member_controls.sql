-- 0018: admin controls for league membership.
--  * Signed-in users may only UPDATE display_name/avatar_url on league_members (column grants
--    from 0012), so admin writes to team_id failed with "permission denied for table
--    league_members". Admins now go through these security-definer functions instead of
--    opening up the column (which would let members move themselves between teams).
--  * admin_add_member(): lets an admin put someone into a league directly. Covers people whose
--    signup stalled with a pending join code (e.g. confirmed their email in another browser and
--    never got signed in, so the automatic join never ran).

create or replace function fantasy_tv.admin_set_member_team(p_league_id uuid, p_user_id uuid, p_team_id uuid)
returns void
language plpgsql security definer set search_path = fantasy_tv, public as $$
begin
  if not fantasy_tv.is_admin() then
    raise exception 'admin only';
  end if;
  if p_team_id is not null and not exists (
    select 1 from fantasy_tv.league_teams where id = p_team_id and league_id = p_league_id
  ) then
    raise exception 'that team is not in this league';
  end if;
  update fantasy_tv.league_members set team_id = p_team_id
  where league_id = p_league_id and user_id = p_user_id;
  if not found then
    raise exception 'that person is not a member of this league';
  end if;
end;
$$;
revoke all on function fantasy_tv.admin_set_member_team(uuid, uuid, uuid) from public, anon;
grant execute on function fantasy_tv.admin_set_member_team(uuid, uuid, uuid) to authenticated;

create or replace function fantasy_tv.admin_add_member(p_league_id uuid, p_user_id uuid, p_team_id uuid default null)
returns void
language plpgsql security definer set search_path = fantasy_tv, public as $$
declare
  v_team uuid := p_team_id;
  v_join_code text;
begin
  if not fantasy_tv.is_admin() then
    raise exception 'admin only';
  end if;
  select join_code into v_join_code from fantasy_tv.leagues where id = p_league_id;
  if v_join_code is null then
    raise exception 'league not found';
  end if;
  if v_team is not null and not exists (
    select 1 from fantasy_tv.league_teams where id = v_team and league_id = p_league_id
  ) then
    raise exception 'that team is not in this league';
  end if;
  -- No team chosen: use the team their invite email is on, if any.
  if v_team is null then
    select i.team_id into v_team
    from fantasy_tv.league_invites i join auth.users u on lower(u.email) = i.email
    where u.id = p_user_id and i.league_id = p_league_id and i.team_id is not null
    limit 1;
  end if;

  insert into fantasy_tv.league_members (league_id, user_id, team_id)
  values (p_league_id, p_user_id, v_team)
  on conflict (league_id, user_id) do update
    set team_id = coalesce(excluded.team_id, fantasy_tv.league_members.team_id);

  -- They're in now: drop the stashed join code so they no longer show as waiting.
  update auth.users
  set raw_user_meta_data = raw_user_meta_data - 'join_code'
  where id = p_user_id and raw_user_meta_data->>'join_code' = v_join_code;
end;
$$;
revoke all on function fantasy_tv.admin_add_member(uuid, uuid, uuid) from public, anon;
grant execute on function fantasy_tv.admin_add_member(uuid, uuid, uuid) to authenticated;
