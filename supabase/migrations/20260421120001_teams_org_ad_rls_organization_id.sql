-- Extend AD team SELECT policy to teams directly owned by organizations on this athletic department.

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
          from public.organizations o
          where o.id = t.organization_id
            and o.athletic_department_id is not distinct from ad.id
        )
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
  'True when the AD manages this team via school row, dept row, direct organizations.organization_id, or program-linked organization.';
