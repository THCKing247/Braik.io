-- Allow Athletic Directors to SELECT teams they manage (school, department, or linked program org).
-- Server API routes use the service role and bypass RLS; this policy supports JWT-based clients and matches app query logic.

create or replace function public.is_athletic_director_team_access(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    join public.profiles p on p.id = auth.uid()
    join public.athletic_departments ad on ad.athletic_director_user_id = p.id
    where t.id = p_team_id
      and lower(replace(p.role, '-', '_')) = 'athletic_director'
      and (
        (t.school_id is not null and t.school_id = ad.school_id)
        or (t.athletic_department_id is not null and t.athletic_department_id = ad.id)
        or exists (
          select 1
          from public.programs pr
          join public.organizations o on o.id = pr.organization_id
          where pr.id = t.program_id
            and o.athletic_department_id = ad.id
        )
      )
  );
$$;

comment on function public.is_athletic_director_team_access(uuid) is
  'True when the current user is the athletic director for the department that owns this team (by school, department, or linked organization program).';

drop policy if exists teams_athletic_director_select on public.teams;
create policy teams_athletic_director_select on public.teams
for select using (public.is_athletic_director_team_access(id));

-- Programs: AD can read programs attached to their organization(s)
create or replace function public.is_athletic_director_program_access(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programs pr
    join public.profiles p on p.id = auth.uid()
    join public.athletic_departments ad on ad.athletic_director_user_id = p.id
    join public.organizations o on o.athletic_department_id = ad.id
    where pr.id = p_program_id
      and lower(replace(p.role, '-', '_')) = 'athletic_director'
      and pr.organization_id = o.id
  );
$$;

drop policy if exists programs_athletic_director_select on public.programs;
create policy programs_athletic_director_select on public.programs
for select using (public.is_athletic_director_program_access(id));

-- Organizations: AD can read their department's organization row(s)
drop policy if exists organizations_athletic_director_select on public.organizations;
create policy organizations_athletic_director_select on public.organizations
for select using (
  exists (
    select 1
    from public.profiles p
    join public.athletic_departments ad on ad.athletic_director_user_id = p.id
    where p.id = auth.uid()
      and lower(replace(p.role, '-', '_')) = 'athletic_director'
      and organizations.athletic_department_id = ad.id
  )
);
