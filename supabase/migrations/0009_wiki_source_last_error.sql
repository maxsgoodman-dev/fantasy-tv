-- Surface fetch/parse failures (e.g. the source blocking our request) on
-- the admin page instead of the server action throwing a 500.
alter table fantasy_tv.show_wiki_sources add column last_error text;
