-- Player Forms Tracking
-- Allows coaches to track which forms are missing for each player

-- Add missing_forms column to players table (stored as JSONB array)
alter table public.players add column if not exists missing_forms jsonb default '[]'::jsonb;
create index if not exists idx_players_missing_forms on public.players using gin(missing_forms);

-- Add forms_complete column to track if all forms are complete
alter table public.players add column if not exists forms_complete boolean default true;

-- Update health_status trigger to consider forms_complete
-- If forms are incomplete, set health_status to 'unavailable' (orange)
create or replace function public.update_player_health_status()
returns trigger
language plpgsql
as $$
declare
  active_injury_count integer;
  player_status_val text;
  forms_complete_val boolean;
begin
  -- Check for active injuries
  select count(*) into active_injury_count
  from public.player_injuries
  where player_id = coalesce(NEW.player_id, OLD.player_id)
    and status = 'active';

  -- Get player status and forms_complete
  select status, coalesce(forms_complete, true) into player_status_val, forms_complete_val
  from public.players
  where id = coalesce(NEW.player_id, OLD.player_id);

  -- Determine health status
  if player_status_val != 'active' or not forms_complete_val then
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

-- Trigger to update health status when forms_complete changes
drop trigger if exists update_player_health_on_forms_change on public.players;

create trigger update_player_health_on_forms_change
after update of forms_complete, missing_forms on public.players
for each row
when (
  (OLD.forms_complete is distinct from NEW.forms_complete) or
  (OLD.missing_forms is distinct from NEW.missing_forms)
)
execute function public.update_player_health_status();

-- Initialize forms_complete for existing players
-- If missing_forms is empty or null, forms are complete
update public.players
set forms_complete = case
  when missing_forms is null or missing_forms = '[]'::jsonb then true
  else false
end
where forms_complete is null;
