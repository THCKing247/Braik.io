-- Coach assignment list: filter by team_id and sort by created_at desc (see GET /api/teams/.../study/assignments).
create index if not exists idx_study_assignments_team_created_at
  on public.study_assignments (team_id, created_at desc);
