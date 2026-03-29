-- AD teams table: speed up `.or(school_id | athletic_department_id | program_id)` + `order by created_at desc`.
-- Planner can use a matching branch per OR arm; partial indexes keep size down.

create index if not exists idx_teams_school_created_at
  on public.teams (school_id, created_at desc nulls last)
  where school_id is not null;

create index if not exists idx_teams_athletic_dept_created_at
  on public.teams (athletic_department_id, created_at desc nulls last)
  where athletic_department_id is not null;

create index if not exists idx_teams_program_created_at
  on public.teams (program_id, created_at desc nulls last)
  where program_id is not null;

-- Creator column lookups when joining users/profiles (smaller helper scans).
create index if not exists idx_teams_created_by
  on public.teams (created_by)
  where created_by is not null;
