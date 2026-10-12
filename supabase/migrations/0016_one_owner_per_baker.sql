-- 0016: in a season draft each contestant can be owned by only one team (user) per league.
-- Applied to production 2026-10-12.
create unique index draft_picks_one_owner_per_contestant on fantasy_tv.draft_picks (league_id, contestant_id);
