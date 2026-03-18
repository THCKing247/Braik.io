-- Ensure public.events exists with all columns required by POST /api/teams/[teamId]/calendar/events.
-- Safe to run on existing DBs: creates table only if missing; adds optional column and policy if missing.
-- Run this if create event returns 500 and events table is missing or incomplete.

-- Create events table if it does not exist (schema matches 20260303000000_profiles_and_auth_sync)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  start timestamptz not null,
  "end" timestamptz not null,
  location text,
  visibility text not null default 'TEAM',
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add optional column from 20260314000000 (safe if table already exists)
alter table public.events add column if not exists linked_injury_id uuid references public.player_injuries(id) on delete set null;

-- Indexes for calendar queries
create index if not exists idx_events_team_id on public.events(team_id);
create index if not exists idx_events_start on public.events(start);
create index if not exists idx_events_linked_injury_id on public.events(linked_injury_id) where linked_injury_id is not null;

-- RLS: ensure enabled (API uses service role and bypasses RLS; policy documents intent)
alter table public.events enable row level security;

-- Allow backend/service role to manage events (service role already bypasses RLS; this helps anon if ever used)
drop policy if exists events_service_role on public.events;
create policy events_service_role on public.events for all using (true) with check (true);
