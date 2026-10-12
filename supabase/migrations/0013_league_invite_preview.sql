-- 0013: public (anon-callable) preview of a league for invite links (/join/CODE).
-- Returns only non-sensitive display info; it never returns the league id or member list.
-- Applied to production 2026-10-12.
create function fantasy_tv.league_invite_preview(p_code text)
returns table (league_name text, show_name text, show_image_url text, theme_color text, member_count bigint)
language sql stable security definer set search_path = fantasy_tv, public as $$
  select l.name, sh.name, sh.image_url, sh.theme_color,
         (select count(*) from fantasy_tv.league_members m where m.league_id = l.id)
  from fantasy_tv.leagues l
  join fantasy_tv.seasons se on se.id = l.season_id
  join fantasy_tv.shows sh on sh.id = se.show_id
  where upper(l.join_code) = upper(trim(p_code))
  limit 1;
$$;
revoke all on function fantasy_tv.league_invite_preview(text) from public;
grant execute on function fantasy_tv.league_invite_preview(text) to anon, authenticated;
