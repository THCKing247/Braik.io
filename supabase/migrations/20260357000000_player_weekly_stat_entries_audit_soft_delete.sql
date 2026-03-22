-- Soft delete, actor columns, and audit trail for player_weekly_stat_entries.

alter table public.player_weekly_stat_entries
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists idx_player_weekly_stat_entries_active
  on public.player_weekly_stat_entries(team_id)
  where deleted_at is null;

create index if not exists idx_player_weekly_stat_entries_player_active
  on public.player_weekly_stat_entries(team_id, player_id)
  where deleted_at is null;

create table if not exists public.player_weekly_stat_entry_audit (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  action text not null check (action in ('create', 'update', 'soft_delete', 'restore')),
  before_data jsonb,
  after_data jsonb,
  acted_by uuid references auth.users(id) on delete set null,
  acted_at timestamptz not null default now()
);

create index if not exists idx_weekly_stat_audit_entry on public.player_weekly_stat_entry_audit(entry_id);
create index if not exists idx_weekly_stat_audit_team on public.player_weekly_stat_entry_audit(team_id, acted_at desc);

alter table public.player_weekly_stat_entry_audit enable row level security;

drop policy if exists player_weekly_stat_entry_audit_service_role on public.player_weekly_stat_entry_audit;
create policy player_weekly_stat_entry_audit_service_role on public.player_weekly_stat_entry_audit
  for all using (true) with check (true);

comment on table public.player_weekly_stat_entry_audit is 'Audit log for weekly stat entry create/update/soft_delete/restore.';
