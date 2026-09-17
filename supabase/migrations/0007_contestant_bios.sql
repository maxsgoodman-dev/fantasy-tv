-- Bio fields for the contestant-bio accordion on the league page. Nullable —
-- populated per-show as bios become available (Traitors New Blood now,
-- Bake Off later). `bio` already existed but was unused until now.
alter table fantasy_tv.contestants add column age int;
alter table fantasy_tv.contestants add column location text;
alter table fantasy_tv.contestants add column occupation text;
