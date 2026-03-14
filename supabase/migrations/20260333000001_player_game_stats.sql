-- Game-by-game player stats for Coach B (explicit team/player/game linkage).
-- Complements players.game_stats JSONB array; context can aggregate from here when present.

create table if not exists public.player_game_stats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_game_stats_team_id on public.player_game_stats(team_id);
create index if not exists idx_player_game_stats_player_id on public.player_game_stats(player_id);
create index if not exists idx_player_game_stats_game_id on public.player_game_stats(game_id);
create unique index if not exists idx_player_game_stats_unique on public.player_game_stats(team_id, player_id, game_id);

alter table public.player_game_stats enable row level security;

drop policy if exists player_game_stats_service_role on public.player_game_stats;
create policy player_game_stats_service_role on public.player_game_stats for all using (true) with check (true);

comment on table public.player_game_stats is 'Per-game player performance; used by Coach B for recent form and trends.';
