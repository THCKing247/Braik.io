-- Optional game-level metadata on weekly stat rows (bulk edit + future UI).

alter table public.player_weekly_stat_entries
  add column if not exists game_type text,
  add column if not exists location text,
  add column if not exists venue text,
  add column if not exists result text,
  add column if not exists team_score integer,
  add column if not exists opponent_score integer,
  add column if not exists notes text;

comment on column public.player_weekly_stat_entries.game_type is 'e.g. regular, playoff (mirrors games.game_type vocabulary).';
comment on column public.player_weekly_stat_entries.location is 'Home / Away / Neutral or free text for this stat line.';
comment on column public.player_weekly_stat_entries.venue is 'Stadium or site name (optional).';
