-- Per-show branding so leagues/cards can reflect each show's own look.
alter table fantasy_tv.shows
  add column theme_color text not null default '#a21caf',
  add column theme_font text not null default 'bold' check (theme_font in ('bold', 'playful'));
