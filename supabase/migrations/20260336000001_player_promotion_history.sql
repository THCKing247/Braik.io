-- Feature 1: Player Promotion System — history of team-level moves (Freshman/JV/Varsity)

create table if not exists public.player_team_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  from_team_id uuid references public.teams(id) on delete set null,
  to_team_id uuid not null references public.teams(id) on delete cascade,
  from_level text check (from_level is null or from_level in ('varsity', 'jv', 'freshman')),
  to_level text not null check (to_level in ('varsity', 'jv', 'freshman')),
  season text,
  promotion_reason text,
  promoted_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_team_history_player on public.player_team_history(player_id);
create index if not exists idx_player_team_history_program on public.player_team_history(program_id);
create index if not exists idx_player_team_history_created_at on public.player_team_history(created_at desc);
alter table public.player_team_history enable row level security;

drop policy if exists player_team_history_service_role on public.player_team_history;
create policy player_team_history_service_role on public.player_team_history for all using (true) with check (true);

comment on table public.player_team_history is 'Historical record when a player is promoted or demoted between program team levels (Freshman, JV, Varsity).';
