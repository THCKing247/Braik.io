-- Player-facing study summary for review / mixed assignments (Coach B or manual).

alter table public.study_assignments
  add column if not exists review_player_summary text;

comment on column public.study_assignments.review_player_summary is 'Optional concise study summary shown to players with review/mixed assignments.';
