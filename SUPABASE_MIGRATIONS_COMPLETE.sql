-- ============================================================================
-- COMPLETE SUPABASE MIGRATIONS FOR HEALTH & ROSTER PRINT/EMAIL
-- ============================================================================
-- Copy and paste these migrations into your Supabase SQL Editor
-- Run them in order (they use IF NOT EXISTS, so safe to rerun)
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Roster Template (for Print/Email feature)
-- ============================================================================
-- File: 20260313000000_roster_template.sql

-- Roster Template: Customizable template for roster print/email
-- Allows coaches to customize the roster format

-- Add roster_template column to teams table
alter table public.teams add column if not exists roster_template jsonb default '{
  "header": {
    "showYear": true,
    "showSchoolName": true,
    "showTeamName": true,
    "yearLabel": "Year",
    "schoolNameLabel": "School",
    "teamNameLabel": "Team"
  },
  "body": {
    "showJerseyNumber": true,
    "showPlayerName": true,
    "showGrade": true,
    "jerseyNumberLabel": "Number",
    "playerNameLabel": "Name",
    "gradeLabel": "Grade",
    "sortBy": "jerseyNumber"
  },
  "footer": {
    "showGeneratedDate": true,
    "customText": ""
  }
}'::jsonb;

-- Add index for roster_template queries (if needed in future)
create index if not exists idx_teams_roster_template on public.teams(id) where roster_template is not null;

-- ============================================================================
-- MIGRATION 2: Player Injuries and Health Tracking
-- ============================================================================
-- File: 20260314000000_player_injuries_health.sql

-- Player Injuries and Health Tracking
-- Allows coaches to track player injuries, expected return dates, and health status

-- Player injuries: injury records with reason and expected return dates
create table if not exists public.player_injuries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  injury_reason text not null,
  injury_date timestamptz not null default now(),
  expected_return_date timestamptz,
  actual_return_date timestamptz,
  status text not null default 'active', -- 'active' (currently injured), 'resolved' (returned), 'cancelled'
  notes text,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_injuries_player_id on public.player_injuries(player_id);
create index if not exists idx_player_injuries_team_id on public.player_injuries(team_id);
create index if not exists idx_player_injuries_status on public.player_injuries(status);
create index if not exists idx_player_injuries_expected_return on public.player_injuries(expected_return_date) where expected_return_date is not null and status = 'active';
alter table public.player_injuries enable row level security;

-- Player health status: computed/denormalized status for quick access
-- Status values: 'active' (green), 'injured' (red), 'unavailable' (orange - form incomplete)
-- This is updated via trigger when injuries change or player status changes
alter table public.players add column if not exists health_status text default 'active';
create index if not exists idx_players_health_status on public.players(health_status);

-- Function to update player health status based on active injuries
create or replace function public.update_player_health_status()
returns trigger
language plpgsql
as $$
declare
  active_injury_count integer;
  player_status_val text;
begin
  -- Check for active injuries
  select count(*) into active_injury_count
  from public.player_injuries
  where player_id = coalesce(NEW.player_id, OLD.player_id)
    and status = 'active';

  -- Get player status (for unavailable check)
  select status into player_status_val
  from public.players
  where id = coalesce(NEW.player_id, OLD.player_id);

  -- Determine health status
  if player_status_val != 'active' then
    -- Player is inactive (form incomplete, etc.) - orange
    update public.players
    set health_status = 'unavailable'
    where id = coalesce(NEW.player_id, OLD.player_id);
  elsif active_injury_count > 0 then
    -- Player has active injury - red
    update public.players
    set health_status = 'injured'
    where id = coalesce(NEW.player_id, OLD.player_id);
  else
    -- Player is active and healthy - green
    update public.players
    set health_status = 'active'
    where id = coalesce(NEW.player_id, OLD.player_id);
  end if;

  return coalesce(NEW, OLD);
end;
$$;

-- Trigger to update health status when injury is created/updated/deleted
create trigger update_player_health_on_injury_change
after insert or update or delete on public.player_injuries
for each row
execute function public.update_player_health_status();

-- Trigger to update health status when player status changes
create trigger update_player_health_on_status_change
after update of status on public.players
for each row
when (OLD.status is distinct from NEW.status)
execute function public.update_player_health_status();

-- Calendar events for injury return dates: automatically create calendar events for expected return dates
-- This will be handled by application code, but we ensure the events table can link to injuries
alter table public.events add column if not exists linked_injury_id uuid references public.player_injuries(id) on delete set null;
create index if not exists idx_events_linked_injury_id on public.events(linked_injury_id) where linked_injury_id is not null;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists player_injuries_service_role on public.player_injuries;
create policy player_injuries_service_role on public.player_injuries for all using (true) with check (true);

-- RLS: Team members can view injuries for their team
drop policy if exists player_injuries_team_member_read on public.player_injuries;
create policy player_injuries_team_member_read on public.player_injuries
  for select
  using (
    public.is_team_member(team_id)
  );

-- RLS: Coaches can manage injuries
drop policy if exists player_injuries_coach_manage on public.player_injuries;
create policy player_injuries_coach_manage on public.player_injuries
  for all
  using (
    public.can_edit_roster(team_id)
  )
  with check (
    public.can_edit_roster(team_id)
  );

-- Initialize health_status for existing players
-- Set to 'active' if status is 'active', otherwise 'unavailable'
update public.players
set health_status = case
  when status = 'active' then 'active'
  else 'unavailable'
end
where health_status is null or health_status = 'active';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migrations to verify everything is set up correctly

-- Check roster_template column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'teams' 
  AND column_name = 'roster_template';

-- Check player_injuries table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'player_injuries';

-- Check health_status column exists on players
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'players' 
  AND column_name = 'health_status';

-- Check linked_injury_id column exists on events
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'events' 
  AND column_name = 'linked_injury_id';

-- Check triggers exist
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'update_player_health_on_injury_change',
    'update_player_health_on_status_change'
  );

-- Check RLS policies exist
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'player_injuries';

-- ============================================================================
-- END OF MIGRATIONS
-- ============================================================================
