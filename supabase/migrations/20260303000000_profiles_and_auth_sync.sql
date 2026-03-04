-- Ensure public.users and public.teams exist (required by invites, compliance_log, events, notifications)
-- Skip if you already ran 20260225_admin_portal.sql
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text,
  plan_tier text not null default 'starter',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- Profiles table for app-specific user data (id = auth.uid() from Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'player',
  team_id uuid,
  phone text,
  sport text,
  program_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_team_id on public.profiles(team_id);
alter table public.profiles enable row level security;

-- Allow users to read/update own profile
drop policy if exists profiles_own_all on public.profiles;
create policy profiles_own_all on public.profiles
for all using (id = auth.uid()) with check (id = auth.uid());

-- Allow service role to manage profiles (for server-side upserts)
drop policy if exists profiles_service_role on public.profiles;
create policy profiles_service_role on public.profiles
for all using (true) with check (true);

-- Invites table (for invite links)
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null,
  token text unique not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- If invites already existed with a different schema, add missing columns
alter table public.invites add column if not exists token text;
alter table public.invites add column if not exists email text;
alter table public.invites add column if not exists role text;
alter table public.invites add column if not exists expires_at timestamptz;
alter table public.invites add column if not exists accepted_at timestamptz;
alter table public.invites add column if not exists created_by uuid references public.users(id) on delete cascade;
alter table public.invites add column if not exists created_at timestamptz default now();
-- Indexes (partial so they work when columns were just added and may be null)
create index if not exists idx_invites_token on public.invites(token) where token is not null;
create index if not exists idx_invites_email on public.invites(email) where email is not null;
alter table public.invites enable row level security;

-- Compliance log (for consent/audit)
create table if not exists public.compliance_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  policy_version text not null,
  timestamp timestamptz not null default now(),
  ip_address text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_compliance_log_user_id on public.compliance_log(user_id);
create index if not exists idx_compliance_log_event_type on public.compliance_log(event_type);
alter table public.compliance_log enable row level security;

-- Team join codes (for invite/signup flow)
alter table public.teams add column if not exists team_id_code text unique;
alter table public.teams add column if not exists player_code text unique;
alter table public.teams add column if not exists parent_code text unique;

-- Events table (for calendar/schedule)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  start timestamptz not null,
  "end" timestamptz not null,
  location text,
  visibility text not null default 'TEAM',
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_events_team_id on public.events(team_id);
create index if not exists idx_events_start on public.events(start);
alter table public.events enable row level security;

-- Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link_url text,
  link_type text,
  link_id text,
  metadata jsonb,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read);
alter table public.notifications enable row level security;
