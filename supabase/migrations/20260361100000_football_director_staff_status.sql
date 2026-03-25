-- Football program hierarchy: director_of_football program role + pending staff on team_members
-- Backward-compatible: existing program_members stay valid; new column defaults to active.

alter table public.program_members drop constraint if exists program_members_role_check;
alter table public.program_members add constraint program_members_role_check check (
  role in (
    'athletic_director',
    'head_coach',
    'assistant_coach',
    'director_of_football'
  )
);

comment on column public.program_members.role is
  'Program-level role. director_of_football = varsity HC + football program director (football-only; not school AD).';

alter table public.team_members
  add column if not exists staff_status text not null default 'active'
  check (staff_status in ('active', 'pending_assignment'));

comment on column public.team_members.staff_status is
  'pending_assignment: linked via code but not yet activated by program head / delegated level head.';

create index if not exists idx_team_members_staff_status
  on public.team_members (team_id, staff_status)
  where staff_status = 'pending_assignment';
