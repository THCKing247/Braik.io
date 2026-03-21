-- Normalize audit_logs for a single canonical app shape across migration histories.
-- Canonical columns (see lib/audit/write-audit-log.ts):
--   actor_id        uuid → acting user (same as "actor user id" in docs)
--   team_id         uuid nullable → scope for team/program actions
--   action_type     text not null
--   target_type     text nullable
--   target_id       text nullable
--   metadata_json   jsonb nullable
--   created_at      timestamptz

-- Base table is created in 20260225_admin_portal / 20260226_super_admin_console; ensure it exists
-- when this migration runs alone or those files were skipped.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  action_type text not null,
  target_type text,
  target_id text,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.audit_logs add column if not exists action_type text;
alter table public.audit_logs add column if not exists metadata_json jsonb;

-- Backfill from legacy column names when present (60225_admin_portal style).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'action'
  ) then
    execute 'update public.audit_logs set action_type = coalesce(action_type, action) where action_type is null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'metadata'
  ) then
    execute 'update public.audit_logs set metadata_json = coalesce(metadata_json, metadata) where metadata_json is null';
  end if;
end $$;

create index if not exists idx_audit_logs_team_created on public.audit_logs(team_id, created_at desc) where team_id is not null;

comment on column public.audit_logs.team_id is 'Optional team scope for filtering coach-facing audit views.';
comment on column public.audit_logs.metadata_json is 'Structured details; prefer over legacy metadata if both exist.';
