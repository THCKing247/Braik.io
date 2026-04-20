-- Canonical team ownership: Organization → Teams (direct FK).
-- Backfill fills organization_id where unambiguous; nullable rows remain until resolved manually.

alter table public.teams
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

comment on column public.teams.organization_id is
  'Owning organization for this team. Preferred source of truth vs legacy program/school/dept linkage.';

create index if not exists idx_teams_organization_id
  on public.teams (organization_id)
  where organization_id is not null;

create index if not exists idx_teams_organization_created_at
  on public.teams (organization_id, created_at desc nulls last)
  where organization_id is not null;

-- 1) From linked program when program.organization_id is set.
update public.teams t
set organization_id = p.organization_id
from public.programs p
where t.organization_id is null
  and t.program_id is not null
  and p.id = t.program_id
  and p.organization_id is not null;

-- 2) Athletic department match: only when exactly one organization shares this department id.
with candidates as (
  select
    t.id as team_id,
    o.id as org_id,
    count(*) over (partition by t.id) as match_count
  from public.teams t
  join public.organizations o on o.athletic_department_id is not distinct from t.athletic_department_id
  where t.organization_id is null
    and t.athletic_department_id is not null
),
uniq as (
  select team_id, org_id from candidates where match_count = 1
)
update public.teams t
set organization_id = uniq.org_id
from uniq
where t.id = uniq.team_id;

-- 3) School-only match on organizations.school_id: only when exactly one organization row for that school.
with candidates as (
  select
    t.id as team_id,
    o.id as org_id,
    count(*) over (partition by t.id) as match_count
  from public.teams t
  join public.organizations o on o.school_id is not distinct from t.school_id
  where t.organization_id is null
    and t.school_id is not null
),
uniq as (
  select team_id, org_id from candidates where match_count = 1
)
update public.teams t
set organization_id = uniq.org_id
from uniq
where t.id = uniq.team_id;
