-- Super Admin Console schema baseline for admin.braik.io
-- Explicitly matches the requested table definitions.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  ai_credits_remaining integer not null default 0,
  ai_tier text not null default 'basic',
  ai_auto_recharge_enabled boolean not null default false
);

alter table public.users add column if not exists ai_credits_remaining integer not null default 0;
alter table public.users add column if not exists ai_tier text not null default 'basic';
alter table public.users add column if not exists ai_auto_recharge_enabled boolean not null default false;
alter table public.users add column if not exists last_login_at timestamptz;
alter table public.users add column if not exists status text not null default 'active';
alter table public.users add column if not exists role text not null default 'user';

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  head_coach_user_id uuid references public.users(id) on delete set null,
  subscription_status text not null default 'active',
  team_status text not null default 'active',
  base_ai_credits integer not null default 0,
  ai_usage_this_cycle integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.teams add column if not exists head_coach_user_id uuid references public.users(id) on delete set null;
alter table public.teams add column if not exists subscription_status text not null default 'active';
alter table public.teams add column if not exists team_status text not null default 'active';
alter table public.teams add column if not exists base_ai_credits integer not null default 0;
alter table public.teams add column if not exists ai_usage_this_cycle integer not null default 0;
alter table public.teams add column if not exists created_at timestamptz not null default now();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  stripe_subscription_id text unique,
  status text not null default 'active',
  current_period_end timestamptz,
  auto_recharge_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  action_type text not null,
  executed_at timestamptz not null default now(),
  undo_available_until timestamptz,
  undone boolean not null default false,
  cost_in_credits numeric(12,2) not null default 0
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id) on delete cascade,
  action_type text not null,
  target_type text,
  target_id text,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_config (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_users_role_status on public.users(role, status);
create index if not exists idx_teams_status on public.teams(subscription_status, team_status);
create index if not exists idx_subscriptions_team_status on public.subscriptions(team_id, status);
create index if not exists idx_agent_actions_team_executed on public.agent_actions(team_id, executed_at desc);
create index if not exists idx_audit_logs_actor_created on public.audit_logs(actor_id, created_at desc);
create index if not exists idx_audit_logs_action_created on public.audit_logs(action_type, created_at desc);

-- RLS
alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.subscriptions enable row level security;
alter table public.agent_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.admin_config enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(u.role) = 'admin'
      and lower(u.status) = 'active'
  );
$$;

drop policy if exists super_admin_all_users on public.users;
create policy super_admin_all_users on public.users
for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists super_admin_all_teams on public.teams;
create policy super_admin_all_teams on public.teams
for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists super_admin_all_subscriptions on public.subscriptions;
create policy super_admin_all_subscriptions on public.subscriptions
for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists super_admin_all_agent_actions on public.agent_actions;
create policy super_admin_all_agent_actions on public.agent_actions
for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists super_admin_all_audit_logs on public.audit_logs;
create policy super_admin_all_audit_logs on public.audit_logs
for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists super_admin_all_admin_config on public.admin_config;
create policy super_admin_all_admin_config on public.admin_config
for all using (public.is_super_admin()) with check (public.is_super_admin());
