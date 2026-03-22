-- Align teams.head_coach_user_id with the primary active head_coach row in team_members (idempotent).

update public.teams t
set head_coach_user_id = tm.user_id
from public.team_members tm
where tm.team_id = t.id
  and tm.active = true
  and lower(tm.role) = 'head_coach'
  and tm.is_primary = true
  and (t.head_coach_user_id is distinct from tm.user_id);
