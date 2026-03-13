-- Player profile activity/history for audit and feed.
-- Used for: photo changed, profile updated, equipment assigned/unassigned, document uploaded/deleted, stats updated.
-- Coaches see full activity; players see activity on own profile when appropriate.

create table if not exists public.player_profile_activity (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action_type text not null,
  target_type text,
  target_id text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_profile_activity_player_created on public.player_profile_activity(player_id, created_at desc);
create index if not exists idx_player_profile_activity_team_created on public.player_profile_activity(team_id, created_at desc);
alter table public.player_profile_activity enable row level security;

drop policy if exists player_profile_activity_service on public.player_profile_activity;
create policy player_profile_activity_service on public.player_profile_activity for all using (true) with check (true);

comment on table public.player_profile_activity is 'Lightweight activity log for player profile changes. Hook point for future notifications.';
