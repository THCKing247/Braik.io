-- Canonical team_members.role values (must stay in sync with TEAM_MEMBERS_DB_ROLES in lib/team-members-sync.ts).
-- Fixes legacy uppercase inserts (e.g. PLAYER from 20260309120000_repair_team_members_from_profiles.sql) vs app snake_case.

update public.team_members
set role = lower(replace(replace(trim(role), '-', '_'), ' ', '_'))
where role is not null;

alter table public.team_members drop constraint if exists team_members_role_check;

alter table public.team_members
  add constraint team_members_role_check check (
    role in (
      'head_coach',
      'assistant_coach',
      'director_of_football',
      'athletic_director',
      'team_admin',
      'trainer',
      'manager',
      'player',
      'parent',
      'school_admin'
    )
  );

comment on constraint team_members_role_check on public.team_members is
  'Allowed membership roles (snake_case). Mirror: TEAM_MEMBERS_DB_ROLES in lib/team-members-sync.ts';
