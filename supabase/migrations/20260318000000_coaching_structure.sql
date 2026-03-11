-- Coaching Structure: Coordinators and Position Coaches
-- Allows head coaches to assign coordinator roles and position coach roles to assistant coaches

-- Add coaching structure columns to profiles table
-- We'll store coordinator roles and position coach roles in profiles for simplicity
alter table public.profiles add column if not exists coordinator_role text check (
  coordinator_role is null or coordinator_role in ('offensive_coordinator', 'defensive_coordinator', 'special_teams_coordinator')
);

alter table public.profiles add column if not exists position_coach_roles text[] default '{}';

-- Create index for coordinator role lookups
create index if not exists idx_profiles_coordinator_role on public.profiles(coordinator_role) where coordinator_role is not null;
create index if not exists idx_profiles_team_coordinator on public.profiles(team_id, coordinator_role) where team_id is not null and coordinator_role is not null;

-- Add comment explaining the structure
comment on column public.profiles.coordinator_role is 'Coordinator role: offensive_coordinator, defensive_coordinator, or special_teams_coordinator. Only one person per team can hold each coordinator role.';
comment on column public.profiles.position_coach_roles is 'Array of position coach roles. A coach can hold multiple position roles. Valid values: OL, WR, QB, RB, TE (offense), DB, LB, DL (defense), Snap, Kick, Punt (special teams).';

-- Function to validate position coach roles
create or replace function public.validate_position_coach_roles(roles text[])
returns boolean
language plpgsql
immutable
as $$
declare
  valid_roles text[] := array['OL', 'WR', 'QB', 'RB', 'TE', 'DB', 'LB', 'DL', 'Snap', 'Kick', 'Punt'];
  role_item text;
begin
  if roles is null or array_length(roles, 1) is null then
    return true; -- Empty array is valid
  end if;
  
  foreach role_item in array roles
  loop
    if not (role_item = any(valid_roles)) then
      return false;
    end if;
  end loop;
  
  return true;
end;
$$;

-- Add check constraint for position coach roles
alter table public.profiles add constraint profiles_position_coach_roles_check 
  check (public.validate_position_coach_roles(position_coach_roles));

-- Function to ensure only one coordinator per role per team
create or replace function public.ensure_single_coordinator()
returns trigger
language plpgsql
as $$
declare
  existing_count integer;
begin
  -- Only check if coordinator_role is being set (not null)
  if new.coordinator_role is not null and new.team_id is not null then
    -- Check if another profile already has this coordinator role for this team
    select count(*) into existing_count
    from public.profiles
    where team_id = new.team_id
      and coordinator_role = new.coordinator_role
      and id != new.id
      and coordinator_role is not null;
    
    if existing_count > 0 then
      raise exception 'Only one person can hold the % role per team', new.coordinator_role;
    end if;
  end if;
  
  return new;
end;
$$;

-- Create trigger to enforce single coordinator per role
drop trigger if exists ensure_single_coordinator_trigger on public.profiles;
create trigger ensure_single_coordinator_trigger
  before insert or update on public.profiles
  for each row
  execute function public.ensure_single_coordinator();
