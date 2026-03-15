-- Coach assignments: offensive/defensive coordinator, JV head, Freshman head (assignment titles, not system roles)

create table if not exists public.coach_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  assignment_type text not null check (assignment_type in (
    'varsity_head', 'jv_head', 'freshman_head',
    'offense_coordinator', 'defense_coordinator', 'special_teams_coordinator'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One assignment per (program, type) e.g. one OC, one DC, one jv_head per program
create unique index if not exists idx_coach_assignments_program_type on public.coach_assignments(program_id, assignment_type);
create index if not exists idx_coach_assignments_program on public.coach_assignments(program_id);
create index if not exists idx_coach_assignments_user on public.coach_assignments(user_id);
alter table public.coach_assignments enable row level security;

drop policy if exists coach_assignments_service_role on public.coach_assignments;
create policy coach_assignments_service_role on public.coach_assignments for all using (true) with check (true);

comment on table public.coach_assignments is 'Assignment titles (OC, DC, JV head, etc.). System role remains assistant_coach for JV/Freshman heads.';
