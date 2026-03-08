-- AD team creation: teams get sport, roster_size, season, created_by
-- Coach invites: optional school/department and invitee name on invites

-- Teams: columns for AD-created teams and display
alter table public.teams add column if not exists sport text;
alter table public.teams add column if not exists roster_size integer;
alter table public.teams add column if not exists season text;
alter table public.teams add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.teams add column if not exists notes text;
create index if not exists idx_teams_sport on public.teams(sport) where sport is not null;

-- Invites: optional AD context and invitee names for coach invites
alter table public.invites add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.invites add column if not exists athletic_department_id uuid references public.athletic_departments(id) on delete set null;
alter table public.invites add column if not exists invitee_first_name text;
alter table public.invites add column if not exists invitee_last_name text;
create index if not exists idx_invites_team_id on public.invites(team_id);
create index if not exists idx_invites_school_id on public.invites(school_id) where school_id is not null;
