-- Structured opponent tendency data for Coach B (scouting, matchup, play fit).
-- Can be populated from reports or manual entry.

create table if not exists public.opponent_tendencies (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  opponent_name text not null,
  source_type text,
  source_id uuid,
  tendency_category text,
  down_distance_tendency text,
  coverage_tendency text,
  pressure_tendency text,
  run_pass_tendency text,
  red_zone_tendency text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_opponent_tendencies_team_id on public.opponent_tendencies(team_id);
create index if not exists idx_opponent_tendencies_opponent on public.opponent_tendencies(team_id, opponent_name);

alter table public.opponent_tendencies enable row level security;

drop policy if exists opponent_tendencies_service_role on public.opponent_tendencies;
create policy opponent_tendencies_service_role on public.opponent_tendencies for all using (true) with check (true);

comment on table public.opponent_tendencies is 'Structured opponent/scouting tendencies for Coach B matchup and play recommendations.';
