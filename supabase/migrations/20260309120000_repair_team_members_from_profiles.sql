-- One-time repair: ensure users with profiles.team_id have an active team_members row.
-- Run this to fix existing users who have profile.team_id set but no team_members row
-- (e.g. from legacy signup or a previously failed insert).
-- Only runs if public.team_members exists (created in 20260225_admin_portal.sql).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'team_members'
  ) THEN
    INSERT INTO public.team_members (team_id, user_id, role, active)
    SELECT
      p.team_id,
      p.id,
      CASE lower(trim(coalesce(p.role, 'player')))
        WHEN 'head_coach' THEN 'HEAD_COACH'
        WHEN 'assistant_coach' THEN 'ASSISTANT_COACH'
        WHEN 'parent' THEN 'PARENT'
        WHEN 'school_admin' THEN 'SCHOOL_ADMIN'
        WHEN 'admin' THEN 'SCHOOL_ADMIN'
        ELSE 'PLAYER'
      END,
      true
    FROM public.profiles p
    INNER JOIN public.teams t ON t.id = p.team_id
    INNER JOIN public.users u ON u.id = p.id
    WHERE p.team_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.team_id = p.team_id
          AND tm.user_id = p.id
          AND tm.active = true
      )
    ON CONFLICT (team_id, user_id) DO UPDATE SET
      active = true,
      role = EXCLUDED.role;
  END IF;
END $$;
