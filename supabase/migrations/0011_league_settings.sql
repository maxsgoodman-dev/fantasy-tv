-- Per-league settings: cap on how many contestants a member can pick
-- (null = unlimited) and per-rule point overrides ({ rule_code: points }).
-- Overrides are applied at read time, so changing them re-scores retroactively.
alter table fantasy_tv.leagues add column max_picks int check (max_picks is null or max_picks > 0);
alter table fantasy_tv.leagues add column scoring_overrides jsonb not null default '{}'::jsonb;

-- Traitors weekly-team league: 4 picks.
update fantasy_tv.leagues set max_picks = 4 where id = '6c10a629-e5c0-45eb-adfd-0f547e1c7c3d';
