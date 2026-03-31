-- Admin Athletic Departments: entitlement limits + team-level assistant override scaffold.
-- Video: athletic_departments.video_clips_enabled is the school/AD master (AND with org + team flags).

alter table public.athletic_departments
  add column if not exists teams_allowed integer not null default 50;

alter table public.athletic_departments
  add column if not exists assistant_coaches_allowed integer not null default 100;

alter table public.athletic_departments
  add column if not exists video_clips_enabled boolean not null default true;

comment on column public.athletic_departments.teams_allowed is 'Max active teams allowed under this athletic department (admin enforcement).';
comment on column public.athletic_departments.assistant_coaches_allowed is 'Max assistant coach seats across teams under this AD (admin enforcement).';
comment on column public.athletic_departments.video_clips_enabled is 'School/AD master for Game Video / Clips; effective access also requires org + team video_clips_enabled when linked.';

alter table public.teams
  add column if not exists assistant_coaches_allowed_override integer;

comment on column public.teams.assistant_coaches_allowed_override is 'Optional future per-team cap on assistant coaches; null = use AD-level limit only.';
