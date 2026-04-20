-- Canonical short-ID routing maps for inspection and optional server lookups.
-- Ordering matches lib/navigation/organization-routes.ts (athletic department + team ordinals).

CREATE OR REPLACE VIEW public.v_braik_organization_route_map AS
SELECT
  ad.id AS organization_portal_uuid,
  lpad(row_number() OVER (ORDER BY ad.created_at NULLS LAST, ad.id)::text, 3, '0') AS short_org_id,
  sch.name AS display_name
FROM public.athletic_departments ad
LEFT JOIN public.schools sch ON sch.id = ad.school_id;

COMMENT ON VIEW public.v_braik_organization_route_map IS
  'Maps athletic_departments.id (portal) to zero-padded short_org_id; order by created_at then id matches app routing.';

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
  lpad(r.team_ord::text, 3, '0') AS short_team_id
FROM ranked r
INNER JOIN public.v_braik_organization_route_map om ON om.organization_portal_uuid = r.organization_portal_uuid;

COMMENT ON VIEW public.v_braik_team_route_map IS
  'Per-portal team ordinals → short_team_id; dedup prefers direct athletic_department_id on team over program linkage. Joins short_org_id for convenience.';

-- Efficient lookups (partial: teams with portal resolution only)
CREATE INDEX IF NOT EXISTS idx_teams_athletic_department_id_route_map
  ON public.teams (athletic_department_id)
  WHERE athletic_department_id IS NOT NULL;

GRANT SELECT ON public.v_braik_organization_route_map TO service_role;
GRANT SELECT ON public.v_braik_team_route_map TO service_role;
