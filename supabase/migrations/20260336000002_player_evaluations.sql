-- Feature 2: Player evaluations for call-up suggestions and depth chart intelligence

create table if not exists public.player_evaluations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  practice_grade text,
  effort_grade text,
  playbook_mastery text,
  coach_notes text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_evaluations_player on public.player_evaluations(player_id);
create index if not exists idx_player_evaluations_program on public.player_evaluations(program_id);
create index if not exists idx_player_evaluations_created_at on public.player_evaluations(created_at desc);
alter table public.player_evaluations enable row level security;

drop policy if exists player_evaluations_service_role on public.player_evaluations;
create policy player_evaluations_service_role on public.player_evaluations for all using (true) with check (true);

comment on table public.player_evaluations is 'Coach evaluations (practice, effort, playbook mastery) per player per program. Supports call-up suggestions.';
