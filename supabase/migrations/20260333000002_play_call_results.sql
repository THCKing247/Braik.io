-- Play-level effectiveness analytics for Coach B (usage, success, yards, situation).
-- Links to plays and optional game for aggregation.

create table if not exists public.play_call_results (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  play_id uuid not null references public.plays(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  yards_gained integer,
  success boolean,
  touchdown boolean not null default false,
  turnover boolean not null default false,
  first_down boolean,
  red_zone_result text,
  down integer,
  distance integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_play_call_results_team_id on public.play_call_results(team_id);
create index if not exists idx_play_call_results_play_id on public.play_call_results(play_id);
create index if not exists idx_play_call_results_game_id on public.play_call_results(game_id) where game_id is not null;

alter table public.play_call_results enable row level security;

drop policy if exists play_call_results_service_role on public.play_call_results;
create policy play_call_results_service_role on public.play_call_results for all using (true) with check (true);

comment on table public.play_call_results is 'Per-call play outcomes for Coach B play recommendation analytics.';
