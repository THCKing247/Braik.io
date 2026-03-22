-- Standardize team_members as staff source of truth: snake_case roles + is_primary for primary head coach.
-- Backfill from teams.head_coach_user_id and teams.created_by where no head coach row exists.

-- 1) Column
alter table public.team_members
  add column if not exists is_primary boolean not null default false;

comment on column public.team_members.is_primary is
  'For role head_coach: true = designated primary head coach for the team.';

-- 2) Normalize legacy roles (e.g. HEAD_COACH, Assistant Coach) to snake_case
update public.team_members
set role = lower(replace(replace(trim(role), '-', '_'), ' ', '_'))
where role is not null;

-- 3) Ensure head coach rows from teams.head_coach_user_id (canonical when set)
insert into public.team_members (team_id, user_id, role, active, is_primary, created_at)
select t.id, t.head_coach_user_id, 'head_coach', true, true, now()
from public.teams t
where t.head_coach_user_id is not null
on conflict (team_id, user_id) do update set
  role = 'head_coach',
  active = true,
  is_primary = excluded.is_primary;

-- 4) Backfill from created_by only when team still has no active head_coach in team_members
insert into public.team_members (team_id, user_id, role, active, is_primary, created_at)
select t.id, t.created_by, 'head_coach', true, true, now()
from public.teams t
where t.created_by is not null
  and not exists (
    select 1
    from public.team_members tm
    where tm.team_id = t.id
      and tm.active = true
      and lower(tm.role) = 'head_coach'
  )
on conflict (team_id, user_id) do update set
  role = 'head_coach',
  active = true,
  is_primary = excluded.is_primary;

-- 5) Single primary head coach per team: prefer head_coach_user_id match, else oldest membership
update public.team_members tm
set is_primary = false
where lower(tm.role) = 'head_coach';

with ranked as (
  select
    tm.team_id,
    tm.user_id,
    row_number() over (
      partition by tm.team_id
      order by
        case
          when t.head_coach_user_id is not null and tm.user_id = t.head_coach_user_id then 0
          else 1
        end,
        tm.created_at asc nulls last,
        tm.user_id asc
    ) as rn
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where tm.active = true
    and lower(tm.role) = 'head_coach'
)
update public.team_members tm
set is_primary = true
from ranked r
where tm.team_id = r.team_id
  and tm.user_id = r.user_id
  and r.rn = 1;
