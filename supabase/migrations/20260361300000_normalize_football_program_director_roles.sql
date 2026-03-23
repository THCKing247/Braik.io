-- Normalize football program_members to explicit Director model (conservative).
-- Complements 20260361200000 which promoted all head_coach → director_of_football globally.
--
-- 1) Non-football programs should not use director_of_football (product: football-only role).
-- 2) Football: director_of_football only for the program creator when created_by_user_id is set.
-- 3) Football: promote creator from head_coach → director_of_football when creator is known.
--
-- After this, JV/Freshman heads who were wrongly director_of_football become head_coach at program level;
-- app enforcement (requireProgramStaffAdmin) blocks non-owner head_coach from program placement on football.

-- A) Demote director_of_football on non-football programs
update public.program_members pm
set
  role = 'head_coach',
  updated_at = now()
from public.programs p
where pm.program_id = p.id
  and pm.active = true
  and pm.role = 'director_of_football'
  and p.sport is not null
  and lower(trim(p.sport)) <> 'football';

-- B) Football: demote director_of_football when user is not the program creator (creator known)
update public.program_members pm
set
  role = 'head_coach',
  updated_at = now()
from public.programs p
where pm.program_id = p.id
  and pm.active = true
  and pm.role = 'director_of_football'
  and lower(trim(coalesce(p.sport, 'football'))) = 'football'
  and p.created_by_user_id is not null
  and pm.user_id <> p.created_by_user_id;

-- C) Football: explicit director for program owner still on head_coach
update public.program_members pm
set
  role = 'director_of_football',
  updated_at = now()
from public.programs p
where pm.program_id = p.id
  and pm.active = true
  and pm.role = 'head_coach'
  and lower(trim(coalesce(p.sport, 'football'))) = 'football'
  and p.created_by_user_id is not null
  and pm.user_id = p.created_by_user_id;

comment on table public.program_members is
  'Program roles. director_of_football = explicit football program director (varsity owner). head_coach at program level may be JV/Freshman or legacy; placement APIs require director or owner on football.';
