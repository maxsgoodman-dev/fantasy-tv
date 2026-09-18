-- Wiki revision id at the last successful check; an unchanged revid means
-- the page hasn't been edited, so parsing/diffing can be skipped entirely.
alter table fantasy_tv.show_wiki_sources add column last_revid text;
