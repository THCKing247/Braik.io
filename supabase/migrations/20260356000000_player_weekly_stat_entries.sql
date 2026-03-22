-- Per-game / weekly stat lines for dashboard Stats (raw entries; season totals stay in players.season_stats).

create table if not exists public.player_weekly_stat_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  season_year integer,
  week_number integer,
  game_id uuid references public.games(id) on delete set null,
  opponent text,
  game_date date,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_weekly_stat_entries_team_id on public.player_weekly_stat_entries(team_id);
create index if not exists idx_player_weekly_stat_entries_player_id on public.player_weekly_stat_entries(player_id);
create index if not exists idx_player_weekly_stat_entries_game_id on public.player_weekly_stat_entries(game_id);
create index if not exists idx_player_weekly_stat_entries_team_season on public.player_weekly_stat_entries(team_id, season_year);
create index if not exists idx_player_weekly_stat_entries_game_date on public.player_weekly_stat_entries(team_id, game_date);

alter table public.player_weekly_stat_entries enable row level security;

drop policy if exists player_weekly_stat_entries_service_role on public.player_weekly_stat_entries;
create policy player_weekly_stat_entries_service_role on public.player_weekly_stat_entries
  for all using (true) with check (true);

comment on table public.player_weekly_stat_entries is 'Raw per-week/per-game player stat lines; All Stats season view still uses players.season_stats.';
