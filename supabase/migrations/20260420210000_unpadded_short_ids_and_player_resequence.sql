-- Canonical short IDs: unpadded decimal strings for org/team/player_account routes.
-- Player account IDs: resequence globally starting at 1200 (stable order by created_at, id).

DROP VIEW IF EXISTS public.v_braik_player_route_map;

CREATE OR REPLACE VIEW public.v_braik_organization_route_map AS
SELECT
  ad.id AS organization_portal_uuid,
  (row_number() OVER (ORDER BY ad.created_at NULLS LAST, ad.id))::text AS short_org_id,
  sch.name AS display_name
FROM public.athletic_departments ad
LEFT JOIN public.schools sch ON sch.id = ad.school_id;

COMMENT ON VIEW public.v_braik_organization_route_map IS
  'Maps athletic_departments.id (portal) to unpadded ordinal short_org_id; order matches app routing.';

CREATE OR REPLACE VIEW public.v_braik_team_route_map AS
WITH direct AS (
  SELECT
    t.id AS team_id,
    t.name AS team_name,
    t.created_at,
    t.athletic_department_id::uuid AS organization_portal_uuid
  FROM public.teams t
  WHERE t.athletic_department_id IS NOT NULL
),
via_program AS (
  SELECT
    t.id AS team_id,
    t.name AS team_name,
    t.created_at,
    o.athletic_department_id::uuid AS organization_portal_uuid
  FROM public.teams t
  INNER JOIN public.programs p ON p.id = t.program_id
  INNER JOIN public.organizations o ON o.id = p.organization_id
  WHERE o.athletic_department_id IS NOT NULL
),
combined AS (
  SELECT team_id, team_name, created_at, organization_portal_uuid, 1 AS src FROM direct
  UNION ALL
  SELECT team_id, team_name, created_at, organization_portal_uuid, 2 AS src FROM via_program
),
dedup AS (
  SELECT DISTINCT ON (team_id)
    team_id,
    team_name,
    created_at,
    organization_portal_uuid
  FROM combined
  ORDER BY team_id, src ASC
),
ranked AS (
  SELECT
    d.team_id,
    d.team_name,
    d.organization_portal_uuid,
    row_number() OVER (
      PARTITION BY d.organization_portal_uuid
      ORDER BY d.created_at NULLS LAST, d.team_id
    ) AS team_ord
  FROM dedup d
)
SELECT
  r.team_id AS team_uuid,
  r.team_name,
  r.organization_portal_uuid,
  om.short_org_id,
  r.team_ord::text AS short_team_id
FROM ranked r
INNER JOIN public.v_braik_organization_route_map om ON om.organization_portal_uuid = r.organization_portal_uuid;

COMMENT ON VIEW public.v_braik_team_route_map IS
  'Per-portal team ordinals as unpadded short_team_id; joins short_org_id for convenience.';

-- Global player_account_id resequence: start at 1200
WITH ordered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.players
)
UPDATE public.players p
SET player_account_id = (1199 + ordered.rn)::text
FROM ordered
WHERE p.id = ordered.id;

SELECT setval(
  'public.braik_player_account_id_seq',
  COALESCE((SELECT MAX(player_account_id::bigint) FROM public.players), 1199)::bigint,
  true
);

CREATE OR REPLACE FUNCTION public.braik_players_assign_player_account_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.player_account_id IS NULL OR btrim(NEW.player_account_id) = '' THEN
    NEW.player_account_id := nextval('public.braik_player_account_id_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.players.player_account_id IS
  'Stable public short id for canonical roster URLs (unpadded decimal text; min 1200 after resequence); maps to players.id UUID internally.';

CREATE OR REPLACE VIEW public.v_braik_player_route_map AS
SELECT
  p.id AS player_uuid,
  p.player_account_id,
  p.team_id AS team_uuid,
  tm.short_team_id,
  tm.short_org_id,
  tm.organization_portal_uuid,
  tm.team_name
FROM public.players p
INNER JOIN public.v_braik_team_route_map tm ON tm.team_uuid = p.team_id;

COMMENT ON VIEW public.v_braik_player_route_map IS
  'Maps players.id to unpadded player_account_id with team/org short IDs for canonical dashboard roster URLs.';

GRANT SELECT ON public.v_braik_player_route_map TO service_role;
