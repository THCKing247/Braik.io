-- Depth Chart: player position assignments and depth ordering
-- Supports unit-based depth charts (offense, defense, special teams)

-- Depth chart entries: player assignments to positions
create table if not exists public.depth_chart_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  unit text not null, -- 'offense', 'defense', 'special_teams'
  position text not null,
  string integer not null, -- Depth string (1 = starter, 2 = backup, etc.)
  player_id uuid references public.players(id) on delete set null,
  formation text, -- Optional formation context
  special_team_type text, -- For special teams (e.g., 'kickoff', 'punt')
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, unit, position, string)
);

create index if not exists idx_depth_chart_entries_team_id on public.depth_chart_entries(team_id);
create index if not exists idx_depth_chart_entries_player_id on public.depth_chart_entries(player_id) where player_id is not null;
create index if not exists idx_depth_chart_entries_unit_position on public.depth_chart_entries(team_id, unit, position);
alter table public.depth_chart_entries enable row level security;

-- Depth chart position labels: custom position labels per team/unit
create table if not exists public.depth_chart_position_labels (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  unit text not null,
  position text not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, unit, position)
);

create index if not exists idx_depth_chart_position_labels_team_id on public.depth_chart_position_labels(team_id);
create index if not exists idx_depth_chart_position_labels_unit on public.depth_chart_position_labels(team_id, unit);
alter table public.depth_chart_position_labels enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists depth_chart_entries_service_role on public.depth_chart_entries;
create policy depth_chart_entries_service_role on public.depth_chart_entries for all using (true) with check (true);

drop policy if exists depth_chart_position_labels_service_role on public.depth_chart_position_labels;
create policy depth_chart_position_labels_service_role on public.depth_chart_position_labels for all using (true) with check (true);
