-- AD Teams list API: faster name resolution + head-coach index (service-role path; RLS unchanged).
-- teams.organization_id: N/A (org is via programs.organization_id — idx_programs_organization exists).

-- Batch resolve display labels for coach/creator columns in one round trip (replaces separate users + profiles selects).
create or replace function public.ad_user_display_names(p_user_ids uuid[])
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    x.id as user_id,
    nullif(trim(coalesce(u.name, p.full_name, '')), '') as display_name
  from unnest(p_user_ids) as x(id)
  left join public.users u on u.id = x.id
  left join public.profiles p on p.id = x.id;
$$;

comment on function public.ad_user_display_names(uuid[]) is
  'Braik AD teams table: coalesce(users.name, profiles.full_name) for a set of user ids (batch; avoids N+1).';

revoke all on function public.ad_user_display_names(uuid[]) from public;
grant execute on function public.ad_user_display_names(uuid[]) to service_role;

-- Narrower than idx_team_members_team_staff_active: AD table only needs head_coach rows when teams.head_coach_user_id is null.
create index if not exists idx_team_members_team_head_coach_active
  on public.team_members (team_id)
  where active = true and role = 'head_coach';
