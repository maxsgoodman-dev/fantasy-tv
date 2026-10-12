-- 0014: admin "User Invites" tracking.
--  * league_invites: emails an admin has invited to a league (admin-only via RLS)
--  * admin_user_overview(): admin-only view of every account (email, signup/confirm
--    state, pending join code, leagues) -- needs auth.users, hence security definer.
-- Applied to production 2026-10-12.
create table fantasy_tv.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fantasy_tv.leagues(id) on delete cascade,
  email text not null check (email = lower(email)),
  invited_by uuid references fantasy_tv.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);
create unique index league_invites_league_email_key on fantasy_tv.league_invites (league_id, email);

alter table fantasy_tv.league_invites enable row level security;
revoke all on fantasy_tv.league_invites from anon, public;
create policy "league_invites_admin_all" on fantasy_tv.league_invites
  for all to authenticated using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());

create function fantasy_tv.admin_user_overview()
returns table (
  user_id uuid, email text, display_name text, role text,
  signed_up_at timestamptz, email_confirmed_at timestamptz, last_sign_in_at timestamptz,
  pending_join_code text, leagues jsonb
)
language plpgsql stable security definer set search_path = fantasy_tv, public as $$
begin
  if not fantasy_tv.is_admin() then
    raise exception 'admin only';
  end if;
  return query
  select u.id, u.email::text, p.display_name, p.role, u.created_at, u.email_confirmed_at, u.last_sign_in_at,
         nullif(u.raw_user_meta_data->>'join_code', ''),
         coalesce((
           select jsonb_agg(jsonb_build_object('league_id', l.id, 'name', l.name, 'joined_at', m.joined_at)
                            order by m.joined_at)
           from fantasy_tv.league_members m join fantasy_tv.leagues l on l.id = m.league_id
           where m.user_id = u.id
         ), '[]'::jsonb)
  from auth.users u
  left join fantasy_tv.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;
revoke all on function fantasy_tv.admin_user_overview() from public, anon;
grant execute on function fantasy_tv.admin_user_overview() to authenticated;
