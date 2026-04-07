-- Fundraising RLS: financials visible only to primary head coach + athletic directors;
-- payment refs visible to all team coaches + ADs; writes only for primary head coach.

create or replace function public.is_primary_head_coach_for_team(team_id_param uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_id_param
      and tm.user_id = auth.uid()
      and tm.active = true
      and tm.role = 'head_coach'
      and coalesce(tm.is_primary, true) = true
  );
$$;

create or replace function public.can_view_fundraising_financials(team_id_param uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_primary_head_coach_for_team(team_id_param)
  or exists (
    select 1
    from public.teams t
    join public.program_members pm on pm.program_id = t.program_id and pm.active = true
    where t.id = team_id_param
      and pm.user_id = auth.uid()
      and pm.role = 'athletic_director'
  )
  or public.is_athletic_director_team_access(team_id_param);
$$;

create or replace function public.can_view_fundraising_payment_refs(team_id_param uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_id_param
      and tm.user_id = auth.uid()
      and tm.active = true
      and tm.role in ('head_coach', 'assistant_coach')
  )
  or exists (
    select 1
    from public.teams t
    join public.program_members pm on pm.program_id = t.program_id and pm.active = true
    where t.id = team_id_param
      and pm.user_id = auth.uid()
      and pm.role = 'athletic_director'
  )
  or public.is_athletic_director_team_access(team_id_param);
$$;

comment on function public.is_primary_head_coach_for_team(uuid) is
  'True when the user is the primary (varsity) head coach for the team.';

-- fundraising_budget
drop policy if exists fundraising_budget_select_coaches on public.fundraising_budget;
drop policy if exists fundraising_budget_write_head on public.fundraising_budget;

create policy fundraising_budget_select_financials on public.fundraising_budget
  for select using (public.can_view_fundraising_financials(team_id));

create policy fundraising_budget_write_primary_hc on public.fundraising_budget
  for all
  using (public.is_primary_head_coach_for_team(team_id))
  with check (public.is_primary_head_coach_for_team(team_id));

-- fundraising_entries
drop policy if exists fundraising_entries_select_coaches on public.fundraising_entries;
drop policy if exists fundraising_entries_write_head on public.fundraising_entries;

create policy fundraising_entries_select_financials on public.fundraising_entries
  for select using (public.can_view_fundraising_financials(team_id));

create policy fundraising_entries_write_primary_hc on public.fundraising_entries
  for all
  using (public.is_primary_head_coach_for_team(team_id))
  with check (public.is_primary_head_coach_for_team(team_id));

-- fundraising_payment_refs
drop policy if exists fundraising_payment_refs_select_coaches on public.fundraising_payment_refs;
drop policy if exists fundraising_payment_refs_write_head on public.fundraising_payment_refs;

create policy fundraising_payment_refs_select_staff on public.fundraising_payment_refs
  for select using (public.can_view_fundraising_payment_refs(team_id));

create policy fundraising_payment_refs_write_primary_hc on public.fundraising_payment_refs
  for all
  using (public.is_primary_head_coach_for_team(team_id))
  with check (public.is_primary_head_coach_for_team(team_id));
