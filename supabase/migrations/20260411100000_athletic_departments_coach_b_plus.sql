-- Coach B+ school (AD) gate — matches video_clips hierarchy (team ∧ org ∧ athletic_department).

alter table public.athletic_departments
  add column if not exists coach_b_plus_enabled boolean not null default false;

comment on column public.athletic_departments.coach_b_plus_enabled is 'School-level master for Coach B+ (actions + voice); effective access also requires org and team when linked.';
