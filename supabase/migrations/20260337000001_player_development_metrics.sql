-- Player Development Dashboard: track improvement over time (0-100 scores)

create table if not exists public.player_development_metrics (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  strength_score integer check (strength_score is null or (strength_score >= 0 and strength_score <= 100)),
  speed_score integer check (speed_score is null or (speed_score >= 0 and speed_score <= 100)),
  football_iq_score integer check (football_iq_score is null or (football_iq_score >= 0 and football_iq_score <= 100)),
  leadership_score integer check (leadership_score is null or (leadership_score >= 0 and leadership_score <= 100)),
  discipline_score integer check (discipline_score is null or (discipline_score >= 0 and discipline_score <= 100)),
  coach_notes text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_development_metrics_player on public.player_development_metrics(player_id);
create index if not exists idx_player_development_metrics_program on public.player_development_metrics(program_id);
create index if not exists idx_player_development_metrics_created_at on public.player_development_metrics(created_at desc);
alter table public.player_development_metrics enable row level security;

drop policy if exists player_development_metrics_service_role on public.player_development_metrics;
create policy player_development_metrics_service_role on public.player_development_metrics for all using (true) with check (true);

comment on table public.player_development_metrics is 'Development scores (0-100) logged by coaches for player improvement tracking.';
