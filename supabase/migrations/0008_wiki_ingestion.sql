-- Wiki-source watching: periodically fetch a show's wiki page, diff its
-- parsed contestant/episode state against the last-seen snapshot, and queue
-- any new outcomes as admin-reviewable suggested events (mapped to real
-- scoring rule codes) rather than writing scores directly.
create table fantasy_tv.show_wiki_sources (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references fantasy_tv.shows(id) on delete cascade,
  season_id uuid references fantasy_tv.seasons(id) on delete cascade,
  url text not null,
  parser text not null, -- 'bakeoff_wiki' | 'traitors_wiki'
  enabled boolean not null default true,
  last_snapshot jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table fantasy_tv.wiki_ingestions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references fantasy_tv.show_wiki_sources(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  -- [{ contestantName, episodeNumber, eventCode, label, points, kind }]
  suggested_events jsonb not null default '[]'::jsonb,
  -- per-event outcome once reviewed: { "<index>": "approved" | "dismissed" }
  reviewed jsonb not null default '{}'::jsonb,
  status text not null default 'pending', -- 'pending' | 'done'
  created_at timestamptz not null default now()
);

alter table fantasy_tv.show_wiki_sources enable row level security;
alter table fantasy_tv.wiki_ingestions enable row level security;

create policy "show_wiki_sources_admin_all" on fantasy_tv.show_wiki_sources for all
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());

create policy "wiki_ingestions_admin_all" on fantasy_tv.wiki_ingestions for all
  using (fantasy_tv.is_admin()) with check (fantasy_tv.is_admin());
