-- Public short player account ID for canonical dashboard roster URLs (no UUIDs in path).
-- Global 6-digit zero-padded string, unique across all players.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS player_account_id text;

-- Backfill stable order: created_at then id
WITH ordered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.players
)
UPDATE public.players p
SET player_account_id = lpad(ordered.rn::text, 6, '0')
FROM ordered
WHERE p.id = ordered.id
  AND (p.player_account_id IS NULL OR p.player_account_id = '');

ALTER TABLE public.players
  ALTER COLUMN player_account_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_player_account_id
  ON public.players (player_account_id);

COMMENT ON COLUMN public.players.player_account_id IS
  'Stable public short id for canonical roster URLs (digits, zero-padded width 6); internal routing maps to players.id UUID.';

-- Sequence for inserts after backfill (next id = max + 1)
CREATE SEQUENCE IF NOT EXISTS public.braik_player_account_id_seq;

SELECT setval(
  'public.braik_player_account_id_seq',
  COALESCE((SELECT MAX(player_account_id::bigint) FROM public.players), 0)::bigint,
  true
);

CREATE OR REPLACE FUNCTION public.braik_players_assign_player_account_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.player_account_id IS NULL OR btrim(NEW.player_account_id) = '' THEN
    NEW.player_account_id := lpad(nextval('public.braik_player_account_id_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS braik_players_assign_player_account_id_bi ON public.players;
CREATE TRIGGER braik_players_assign_player_account_id_bi
  BEFORE INSERT ON public.players
  FOR EACH ROW
  EXECUTE PROCEDURE public.braik_players_assign_player_account_id();

-- Inspection: player UUID ↔ short account id ↔ team/org short ids (matches app ordinal views).
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
  'Maps players.id to player_account_id with team/org short IDs for canonical /dashboard/org/.../roster/:playerAccountId routes.';

GRANT SELECT ON public.v_braik_player_route_map TO service_role;
