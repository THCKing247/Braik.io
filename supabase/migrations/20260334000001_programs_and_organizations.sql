-- Programs and Organizations: unified product model
-- Programs group teams (Varsity, JV, Freshman). Organizations wrap AD-owned schools/departments.

-- Organizations: optional top-level container for Athletic Director
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  school_id uuid references public.schools(id) on delete set null,
  athletic_department_id uuid references public.athletic_departments(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_school on public.organizations(school_id) where school_id is not null;
create index if not exists idx_organizations_athletic_department on public.organizations(athletic_department_id) where athletic_department_id is not null;
alter table public.organizations enable row level security;

-- Programs: group related teams (Varsity, JV, Freshman) under one billing/plan
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  program_name text not null,
  sport text not null default 'football',
  plan_type text not null check (plan_type in ('head_coach', 'athletic_director')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_programs_organization on public.programs(organization_id) where organization_id is not null;
create index if not exists idx_programs_created_by on public.programs(created_by_user_id);
alter table public.programs enable row level security;

-- Teams: add program_id and team_level; keep existing team_id_code for backward compat
alter table public.teams add column if not exists program_id uuid references public.programs(id) on delete cascade;
alter table public.teams add column if not exists team_level text check (team_level is null or team_level in ('varsity', 'jv', 'freshman'));
alter table public.teams add column if not exists roster_creation_mode text check (roster_creation_mode is null or roster_creation_mode in ('coach_precreated', 'player_self_create'));
alter table public.teams add column if not exists plan_type text check (plan_type is null or plan_type in ('head_coach', 'athletic_director'));

create index if not exists idx_teams_program_id on public.teams(program_id) where program_id is not null;

comment on column public.teams.program_id is 'Program this team belongs to. Null for legacy teams until backfilled.';
comment on column public.teams.team_level is 'varsity | jv | freshman. Null for legacy.';
comment on column public.teams.roster_creation_mode is 'coach_precreated: coach creates player profiles; player_self_create: player signs up and profile is created.';
comment on column public.teams.plan_type is 'head_coach | athletic_director. Drives billing.';

-- Program members: program-level roles (head_coach, assistant_coach, athletic_director)
create table if not exists public.program_members (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('athletic_director', 'head_coach', 'assistant_coach')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, user_id)
);

create index if not exists idx_program_members_program on public.program_members(program_id);
create index if not exists idx_program_members_user on public.program_members(user_id);
alter table public.program_members enable row level security;

-- RLS: service role full access (API uses service role)
drop policy if exists organizations_service_role on public.organizations;
create policy organizations_service_role on public.organizations for all using (true) with check (true);

drop policy if exists programs_service_role on public.programs;
create policy programs_service_role on public.programs for all using (true) with check (true);

drop policy if exists program_members_service_role on public.program_members;
create policy program_members_service_role on public.program_members for all using (true) with check (true);
