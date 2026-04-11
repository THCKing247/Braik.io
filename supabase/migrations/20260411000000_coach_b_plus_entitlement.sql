-- Coach B+ entitlement: gated "action" layer (calendar mutations, proposals, roster/announcement actions).
-- Default OFF everywhere; enable per organization and/or team for pilots and internal testing.

alter table public.organizations
  add column if not exists coach_b_plus_enabled boolean not null default false;

alter table public.teams
  add column if not exists coach_b_plus_enabled boolean not null default false;

comment on column public.organizations.coach_b_plus_enabled is 'When true (with team flag), Coach B may execute action tools for teams under this org.';
comment on column public.teams.coach_b_plus_enabled is 'Team-level Coach B+; effective entitlement also requires org when the team is linked to a program/org.';
