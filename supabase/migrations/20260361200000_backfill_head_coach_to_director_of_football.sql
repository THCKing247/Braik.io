-- Backfill: every existing program head coach → director_of_football (matches new “Director of Football / Varsity HC” model).
-- App treats director_of_football like head_coach for permissions (lib/auth/rbac.ts).
-- To limit to football-only programs instead, join `programs` and add: and lower(trim(p.sport)) = 'football'

update public.program_members
set
  role = 'director_of_football',
  updated_at = now()
where role = 'head_coach'
  and active = true;
