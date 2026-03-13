-- Player Profile: extended fields for single source of truth (Coach + Player Portal)
-- All profile data lives on public.players; both portals read/write the same record.

-- Basic info (extend existing players table)
alter table public.players add column if not exists preferred_name text;
alter table public.players add column if not exists secondary_position text;
alter table public.players add column if not exists graduation_year integer;
alter table public.players add column if not exists date_of_birth date;
alter table public.players add column if not exists school text;
alter table public.players add column if not exists parent_guardian_contact text;
alter table public.players add column if not exists player_phone text;
alter table public.players add column if not exists address text;
alter table public.players add column if not exists emergency_contact text;
alter table public.players add column if not exists medical_notes text;

-- Team-related (status already exists; add eligibility and role/depth display)
alter table public.players add column if not exists eligibility_status text default 'eligible';
alter table public.players add column if not exists role_depth_notes text;

-- Stats and coach notes
alter table public.players add column if not exists season_stats jsonb default '{}'::jsonb;
alter table public.players add column if not exists game_stats jsonb default '[]'::jsonb;
alter table public.players add column if not exists practice_metrics jsonb default '{}'::jsonb;
alter table public.players add column if not exists coach_notes text;

-- Equipment: stored as jsonb for assigned gear (helmet, pads, jerseys, etc.); inventory_items.assigned_to_player_id also used
alter table public.players add column if not exists assigned_equipment jsonb default '{}'::jsonb;
alter table public.players add column if not exists equipment_issue_return_notes text;

-- Documents / extras
alter table public.players add column if not exists profile_tags jsonb default '[]'::jsonb;
alter table public.players add column if not exists profile_notes text;
alter table public.players add column if not exists document_refs jsonb default '[]'::jsonb;

-- Self-service: which fields the player can edit (coach-configurable per team later; for now we allow in API)
-- No column needed; enforced in API by role.

comment on column public.players.preferred_name is 'Nickname or preferred name';
comment on column public.players.graduation_year is 'Class year / graduation year';
comment on column public.players.eligibility_status is 'e.g. eligible, ineligible, pending';
comment on column public.players.season_stats is 'Season-level stats (object)';
comment on column public.players.game_stats is 'Per-game stats (array of objects)';
comment on column public.players.assigned_equipment is 'Snapshot or refs to assigned gear (helmet, pads, jerseys, etc.)';
