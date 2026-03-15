-- Player invites: token-based roster linking so players can join via link without manual codes.
-- Coach invites by email/phone; when player signs up or logs in with matching identity, auto-link is possible.

create table if not exists public.player_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  email text,
  phone text,
  token text unique not null,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  claimed_by_user_id uuid references public.users(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes for lookup by email (case-insensitive), phone, token, status
create index if not exists idx_player_invites_lower_email
  on public.player_invites (lower(email)) where email is not null;
create index if not exists idx_player_invites_phone
  on public.player_invites (phone) where phone is not null;
create index if not exists idx_player_invites_token
  on public.player_invites (token);
create index if not exists idx_player_invites_status
  on public.player_invites (status);
create index if not exists idx_player_invites_player_id
  on public.player_invites (player_id);
create index if not exists idx_player_invites_team_id
  on public.player_invites (team_id);

alter table public.player_invites enable row level security;

drop policy if exists player_invites_service_role on public.player_invites;
create policy player_invites_service_role on public.player_invites
  for all using (true) with check (true);

comment on table public.player_invites is 'Token-based invites for roster spots. Coach creates invite; player redeems via /join?token=... or auto-claim by matching email/phone.';
