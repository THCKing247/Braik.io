-- AD teams table: active head_coach / assistant_coach rows per team (avoids scanning full rosters).
create index if not exists idx_team_members_team_staff_active
  on public.team_members (team_id)
  where active = true and role in ('head_coach', 'assistant_coach');
