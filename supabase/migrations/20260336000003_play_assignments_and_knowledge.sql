-- Feature 3: Playbook Learning System — play assignments by program/level and player mastery

-- Play assignments: which plays are assigned to which program/team level
create table if not exists public.play_assignments (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  team_level text not null check (team_level in ('varsity', 'jv', 'freshman')),
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(play_id, program_id, team_level)
);

create index if not exists idx_play_assignments_play on public.play_assignments(play_id);
create index if not exists idx_play_assignments_program_level on public.play_assignments(program_id, team_level);
alter table public.play_assignments enable row level security;

drop policy if exists play_assignments_service_role on public.play_assignments;
create policy play_assignments_service_role on public.play_assignments for all using (true) with check (true);

comment on table public.play_assignments is 'Assigns plays to a program team level (varsity/jv/freshman) for learning.';

-- Player play knowledge: per-player mastery of assigned plays
create table if not exists public.player_play_knowledge (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  play_id uuid not null references public.plays(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'viewed', 'completed', 'quiz_passed')),
  quiz_score numeric(5,2),
  last_viewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, play_id, program_id)
);

create index if not exists idx_player_play_knowledge_player on public.player_play_knowledge(player_id);
create index if not exists idx_player_play_knowledge_play on public.player_play_knowledge(play_id);
create index if not exists idx_player_play_knowledge_program on public.player_play_knowledge(program_id);
create index if not exists idx_player_play_knowledge_status on public.player_play_knowledge(player_id, program_id, status);
alter table public.player_play_knowledge enable row level security;

drop policy if exists player_play_knowledge_service_role on public.player_play_knowledge;
create policy player_play_knowledge_service_role on public.player_play_knowledge for all using (true) with check (true);

comment on table public.player_play_knowledge is 'Tracks player progress (viewed, completed, quiz_passed) per play per program.';
