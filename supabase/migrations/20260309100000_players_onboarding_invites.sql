-- Player onboarding: coach-created profiles, invite/join codes, and billing clarity
-- Supports: create player without account -> send invite -> player signs up and links to existing record

-- 0. Ensure public.players exists (in case 20260309000000_players_documents_inventory was not run)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  grade integer,
  jersey_number integer,
  position_group text,
  status text not null default 'active',
  notes text,
  image_url text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_players_team_id on public.players(team_id);
create index if not exists idx_players_user_id on public.players(user_id) where user_id is not null;
alter table public.players enable row level security;
drop policy if exists players_service_role on public.players;
create policy players_service_role on public.players for all using (true) with check (true);

-- 1. Players: optional email, invite code, status, claimed_at, created_by (for billing/audit)
alter table public.players add column if not exists email text;
alter table public.players add column if not exists invite_code text unique;
alter table public.players add column if not exists invite_status text not null default 'not_invited'
  check (invite_status in ('not_invited', 'invited', 'joined'));
alter table public.players add column if not exists claimed_at timestamptz;
alter table public.players add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists idx_players_invite_code on public.players(invite_code) where invite_code is not null;
create index if not exists idx_players_created_by on public.players(created_by) where created_by is not null;
create index if not exists idx_players_team_email on public.players(team_id, lower(email)) where email is not null;

-- Prevent duplicate coach-created players: same team + same name + same jersey (or same email if provided)
-- Use a unique partial index: one active unclaimed player per (team_id, lower(first_name), lower(last_name), jersey_number) when jersey_number is set
-- and one per (team_id, lower(email)) when email is set. We do this in app logic; DB unique would be too strict for "same name different jersey".
comment on column public.players.invite_status is 'not_invited | invited | joined. joined = account linked (user_id set).';
comment on column public.players.claimed_at is 'When the player linked their account (user_id set).';
comment on column public.players.created_by is 'Coach (auth user id) who created this roster record.';

-- 2. Invites: add code, uses, max_uses for team/player join-by-code flows (signup-secure, team/join)
alter table public.invites add column if not exists code text;
alter table public.invites add column if not exists uses integer not null default 0;
alter table public.invites add column if not exists max_uses integer;

create unique index if not exists idx_invites_code on public.invites(code) where code is not null;

-- Teams: optional invite_code for head-coach signup flow (some code paths insert it)
alter table public.teams add column if not exists invite_code text;
