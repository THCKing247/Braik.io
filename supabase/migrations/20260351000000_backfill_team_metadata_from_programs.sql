-- Backfill denormalized team metadata from programs and organizations for existing rows
-- (e.g. legacy signup teams, or teams linked before sync-program-teams-metadata ran).

-- Organizations created before school_id was set on insert: copy from athletic department
update public.organizations o
set school_id = ad.school_id
from public.athletic_departments ad
where o.athletic_department_id = ad.id
  and o.school_id is null
  and ad.school_id is not null;

update public.teams t
set sport = coalesce(t.sport, p.sport, 'football')
from public.programs p
where t.program_id = p.id
  and t.sport is null;

update public.teams t
set school_id = coalesce(t.school_id, o.school_id, ad.school_id)
from public.programs p
join public.organizations o on o.id = p.organization_id
left join public.athletic_departments ad on ad.id = o.athletic_department_id
where t.program_id = p.id
  and p.organization_id is not null
  and t.school_id is null;

update public.teams t
set athletic_department_id = coalesce(t.athletic_department_id, o.athletic_department_id)
from public.programs p
join public.organizations o on o.id = p.organization_id
where t.program_id = p.id
  and p.organization_id is not null
  and t.athletic_department_id is null
  and o.athletic_department_id is not null;

-- roster_size from active roster count when still null
update public.teams t
set roster_size = s.cnt
from (
  select team_id, count(*)::integer as cnt
  from public.players
  group by team_id
) s
where t.id = s.team_id
  and t.roster_size is null
  and s.cnt > 0;
