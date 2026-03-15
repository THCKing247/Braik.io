-- Invite codes: typed codes for head coach, assistant coach, player join, player claim, parent link

create type public.invite_code_type as enum (
  'head_coach_team_invite',
  'assistant_coach_invite',
  'team_player_join',
  'player_claim_invite',
  'parent_link_invite'
);

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  invite_type public.invite_code_type not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  program_id uuid references public.programs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  target_player_id uuid references public.players(id) on delete cascade,
  target_role text,
  max_uses integer,
  uses integer not null default 0,
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique code among active codes only (expiry checked at runtime; now() cannot be used in index predicate)
create unique index if not exists idx_invite_codes_code on public.invite_codes(code) where is_active;
create index if not exists idx_invite_codes_program on public.invite_codes(program_id) where program_id is not null;
create index if not exists idx_invite_codes_team on public.invite_codes(team_id) where team_id is not null;
create index if not exists idx_invite_codes_target_player on public.invite_codes(target_player_id) where target_player_id is not null;
alter table public.invite_codes enable row level security;

drop policy if exists invite_codes_service_role on public.invite_codes;
create policy invite_codes_service_role on public.invite_codes for all using (true) with check (true);

comment on table public.invite_codes is 'Typed invite/join codes. Use invite_type to validate usage (e.g. team_player_join for team code, player_claim_invite for player code).';
