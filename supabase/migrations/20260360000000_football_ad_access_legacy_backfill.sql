-- Phase 1: legacy data for football AD access resolution (computed in app; no new columns).
-- Safe to re-run: updates only nulls / missing membership rows.

-- Treat legacy program-linked teams without team_level as varsity (JV/Freshman remain explicit).
update public.teams t
set team_level = 'varsity'
where t.team_level is null
  and t.program_id is not null;

-- programs.created_by_user_id: earliest team creator when still null
update public.programs p
set created_by_user_id = sub.creator
from (
  select distinct on (program_id)
    program_id as pid,
    created_by as creator
  from public.teams
  where program_id is not null
    and created_by is not null
  order by program_id, created_at asc nulls last
) sub
where p.id = sub.pid
  and p.created_by_user_id is null;

-- program_members: ensure creator is listed as head_coach so isProgramOwner() succeeds for legacy accounts
insert into public.program_members (program_id, user_id, role)
select p.id, p.created_by_user_id, 'head_coach'
from public.programs p
where p.created_by_user_id is not null
  and exists (select 1 from public.users u where u.id = p.created_by_user_id)
  and not exists (
    select 1
    from public.program_members pm
    where pm.program_id = p.id
      and pm.user_id = p.created_by_user_id
  )
on conflict (program_id, user_id) do nothing;
