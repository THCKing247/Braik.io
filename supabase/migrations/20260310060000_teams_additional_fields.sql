-- Additional team fields: fields referenced in code but not yet in schema
-- Based on DASHBOARD_DATA_REQUIREMENTS.md and code references

-- Add missing team fields
alter table public.teams add column if not exists slogan text;
alter table public.teams add column if not exists logo_url text;
alter table public.teams add column if not exists season_name text;
alter table public.teams add column if not exists dues_amount numeric(10,2);
alter table public.teams add column if not exists dues_due_date timestamptz;
alter table public.teams add column if not exists service_status text default 'ACTIVE'; -- For team suspension checks

-- Add indexes for new fields if needed
create index if not exists idx_teams_service_status on public.teams(service_status) where service_status is not null;
