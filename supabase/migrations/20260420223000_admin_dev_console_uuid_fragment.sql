-- Developer console: UUID fragment search across core entity tables (admin tooling only).
-- Called only from the Next.js API via service-role Supabase client (never exposed as raw SQL).
--
-- Why DROP FUNCTION IF EXISTS instead of CREATE OR REPLACE:
-- PostgreSQL treats CREATE OR REPLACE FUNCTION as replacing only when the OUT / RETURNS TABLE
-- signature matches. Changing column names or types on RETURNS TABLE(...) leaves the OID in place
-- but Postgres rejects REPLACE when the row shape is not compatible — so deployments that already
-- had `admin_dev_console_uuid_fragment(text)` returning (source_table, entity_id) must DROP first.

DROP FUNCTION IF EXISTS public.admin_dev_console_uuid_fragment(text);

CREATE FUNCTION public.admin_dev_console_uuid_fragment(fragment text)
RETURNS TABLE (
  source_table text,
  matched_column text,
  record_id uuid,
  label text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  frag text := trim(lower(fragment));
BEGIN
  IF frag IS NULL OR length(frag) < 8 THEN
    RETURN;
  END IF;

  -- Each branch queries only when the heap relation exists (fresh/partial clones, renamed schemas).
  IF to_regclass('public.users') IS NOT NULL THEN
    RETURN QUERY EXECUTE $uq$
      SELECT 'users'::text AS source_table,
             'id'::text AS matched_column,
             u.id AS record_id,
             coalesce(nullif(trim(u.name), ''), nullif(trim(u.email), ''), u.id::text)::text AS label,
             u.created_at AS created_at
      FROM public.users u
      WHERE u.id::text ILIKE '%' || $1 || '%'
      LIMIT 15
    $uq$
    USING frag;
  END IF;

  IF to_regclass('public.teams') IS NOT NULL THEN
    RETURN QUERY EXECUTE $tq$
      SELECT 'teams'::text AS source_table,
             'id'::text AS matched_column,
             t.id AS record_id,
             coalesce(nullif(trim(t.name), ''), t.id::text)::text AS label,
             t.created_at AS created_at
      FROM public.teams t
      WHERE t.id::text ILIKE '%' || $1 || '%'
      LIMIT 15
    $tq$
    USING frag;
  END IF;

  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    RETURN QUERY EXECUTE $sq$
      SELECT 'subscriptions'::text AS source_table,
             'id'::text AS matched_column,
             s.id AS record_id,
             coalesce(nullif(trim(s.stripe_subscription_id), ''), s.team_id::text, s.id::text)::text AS label,
             s.created_at AS created_at
      FROM public.subscriptions s
      WHERE s.id::text ILIKE '%' || $1 || '%'
      LIMIT 15
    $sq$
    USING frag;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_dev_console_uuid_fragment(text) IS
  'Returns rows matching a UUID substring (min 8 chars): source_table, matched_column, record_id, label, created_at. Uses to_regclass so environments without all three tables deploy cleanly.';
