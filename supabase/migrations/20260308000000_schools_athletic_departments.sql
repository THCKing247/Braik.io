-- Schools and Athletic Departments for Athletic Director portal
-- Supports department-wide management and Athletic Department License.

-- Schools (one per institution)
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  city text,
  state text,
  school_type text,
  mascot text,
  website text,
  conference_district text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_schools_slug on public.schools(slug) where slug is not null;
create index if not exists idx_schools_created_by on public.schools(created_by);
alter table public.schools enable row level security;

-- Athletic departments (one per school, linked to AD user)
create table if not exists public.athletic_departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  athletic_director_user_id uuid not null references auth.users(id) on delete cascade,
  department_plan_type text not null default 'athletic_department_license',
  estimated_team_count integer,
  estimated_athlete_count integer,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id)
);

create index if not exists idx_athletic_departments_school on public.athletic_departments(school_id);
create index if not exists idx_athletic_departments_ad_user on public.athletic_departments(athletic_director_user_id);
alter table public.athletic_departments enable row level security;

-- Link profiles to school (for athletic_director role)
alter table public.profiles add column if not exists school_id uuid references public.schools(id) on delete set null;
create index if not exists idx_profiles_school_id on public.profiles(school_id) where school_id is not null;

-- Optional: link teams to school/department (for future department-scoped teams)
alter table public.teams add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.teams add column if not exists athletic_department_id uuid references public.athletic_departments(id) on delete set null;
create index if not exists idx_teams_school_id on public.teams(school_id) where school_id is not null;
create index if not exists idx_teams_athletic_department_id on public.teams(athletic_department_id) where athletic_department_id is not null;

-- RLS: service role can do anything; users can read their own school/department
drop policy if exists schools_service_role on public.schools;
create policy schools_service_role on public.schools for all using (true) with check (true);

drop policy if exists athletic_departments_service_role on public.athletic_departments;
create policy athletic_departments_service_role on public.athletic_departments for all using (true) with check (true);

-- Allow AD to read/update their own department and school
drop policy if exists athletic_departments_ad_own on public.athletic_departments;
create policy athletic_departments_ad_own on public.athletic_departments
  for all using (athletic_director_user_id = auth.uid()) with check (athletic_director_user_id = auth.uid());

drop policy if exists schools_ad_own on public.schools;
create policy schools_ad_own on public.schools
  for select using (
    exists (
      select 1 from public.athletic_departments ad
      where ad.school_id = schools.id and ad.athletic_director_user_id = auth.uid()
    )
  );
create policy schools_ad_update on public.schools
  for update using (
    exists (
      select 1 from public.athletic_departments ad
      where ad.school_id = schools.id and ad.athletic_director_user_id = auth.uid()
    )
  ) with check (true);
