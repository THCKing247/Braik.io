-- System settings with append-only versioning + rollout scope.
create table if not exists public.system_config (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value_json jsonb not null default '{}'::jsonb,
  version integer not null,
  applied_scope text not null check (applied_scope in ('future_only', 'all', 'selective')),
  applied_team_ids uuid[] null,
  applied_at timestamptz not null default now(),
  applied_by uuid not null references public.users(id) on delete cascade
);

create unique index if not exists idx_system_config_key_version on public.system_config(key, version);
create index if not exists idx_system_config_applied_at on public.system_config(applied_at desc);
create index if not exists idx_system_config_scope on public.system_config(applied_scope);

alter table public.system_config enable row level security;

drop policy if exists super_admin_all_system_config on public.system_config;
create policy super_admin_all_system_config on public.system_config
for all using (public.is_super_admin()) with check (public.is_super_admin());
