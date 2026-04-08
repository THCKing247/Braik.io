-- Player claim-or-create roster flow: claim_status, created_source, self_registered, constraints.

-- Claim lifecycle for roster rows
alter table public.players add column if not exists claim_status text;
alter table public.players drop constraint if exists players_claim_status_check;
alter table public.players add constraint players_claim_status_check
  check (claim_status is null or claim_status in ('unclaimed', 'claimed', 'pending_review'));

update public.players set claim_status = 'claimed' where user_id is not null and (claim_status is null);
update public.players set claim_status = 'unclaimed' where user_id is null and (claim_status is null);
alter table public.players alter column claim_status set default 'unclaimed';
update public.players set claim_status = 'unclaimed' where claim_status is null;
alter table public.players alter column claim_status set not null;

comment on column public.players.claim_status is 'unclaimed: no linked auth user; claimed: linked and verified; pending_review: self-signup or ambiguous match awaiting coach.';

-- Provenance
alter table public.players add column if not exists created_source text;
alter table public.players drop constraint if exists players_created_source_check;
alter table public.players add constraint players_created_source_check
  check (created_source is null or created_source in ('coach', 'import', 'player', 'admin'));

update public.players set created_source = 'coach' where created_by is not null and created_source is null;
update public.players set created_source = 'import' where created_source is null;
alter table public.players alter column created_source set default 'coach';
alter table public.players alter column created_source set not null;

alter table public.players add column if not exists self_registered boolean not null default false;

-- Optional per-player claim invite (distinct from invite_code / team join)
alter table public.players add column if not exists claim_invite_code text;
alter table public.players add column if not exists claim_invite_expires_at timestamptz;
create unique index if not exists idx_players_claim_invite_code
  on public.players(claim_invite_code) where claim_invite_code is not null;

-- One auth user -> at most one player row globally
create unique index if not exists idx_players_user_id_unique
  on public.players(user_id) where user_id is not null;

comment on column public.players.self_registered is 'True when the player row was created by player self-signup (team join code flow).';

-- teams.player_code is the team-wide player join code (no new column; documented here)
comment on column public.teams.player_code is 'Team-wide join code for players; used with claim-or-create matching.';
