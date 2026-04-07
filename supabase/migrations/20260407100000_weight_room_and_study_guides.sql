-- Weight Room + Study Guides: tables, indexes, RLS (team-scoped).
-- API routes use service role; policies enforce defense-in-depth for direct Supabase access.

-- ---------------------------------------------------------------------------
-- Players: current maxes (synced from player_maxes)
-- ---------------------------------------------------------------------------
alter table public.players add column if not exists max_bench_lbs integer;
alter table public.players add column if not exists max_squat_lbs integer;
alter table public.players add column if not exists max_power_clean_lbs integer;
alter table public.players add column if not exists max_deadlift_lbs integer;

-- ---------------------------------------------------------------------------
-- Weight room
-- ---------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 6),
  title text not null,
  description text,
  start_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  position_groups jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workout_sessions_team_day on public.workout_sessions(team_id, day_of_week);

create table if not exists public.workout_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  attendance_date date not null,
  created_at timestamptz not null default now(),
  unique (session_id, player_id, attendance_date)
);

create index if not exists idx_workout_attendance_session on public.workout_attendance(session_id);
create index if not exists idx_workout_attendance_player on public.workout_attendance(player_id);

create table if not exists public.player_maxes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  lift_type text not null check (lift_type in ('BENCH', 'SQUAT', 'CLEAN', 'DEADLIFT')),
  weight_lbs integer not null check (weight_lbs > 0),
  logged_date date not null default (current_date),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_maxes_team_player on public.player_maxes(team_id, player_id);
create index if not exists idx_player_maxes_lift on public.player_maxes(team_id, lift_type);

-- ---------------------------------------------------------------------------
-- Study guides
-- ---------------------------------------------------------------------------
create table if not exists public.study_packs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_pack_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.study_packs(id) on delete cascade,
  item_type text not null check (item_type in ('playbook', 'install_script', 'formation')),
  item_id uuid not null,
  sort_order integer not null default 0
);

create index if not exists idx_study_pack_items_pack on public.study_pack_items(pack_id);

create table if not exists public.study_assignments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  due_date timestamptz,
  assigned_to_type text not null check (assigned_to_type in ('team', 'position_group', 'players')),
  assigned_position_group text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_study_assignments_team on public.study_assignments(team_id);

create table if not exists public.study_assignment_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.study_assignments(id) on delete cascade,
  item_type text not null check (item_type in ('playbook', 'install_script', 'study_pack')),
  item_id uuid not null,
  sort_order integer not null default 0
);

create index if not exists idx_study_assignment_items_a on public.study_assignment_items(assignment_id);

create table if not exists public.study_assignment_players (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.study_assignments(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  time_spent_seconds integer not null default 0,
  completed_at timestamptz,
  last_activity_at timestamptz,
  unique (assignment_id, player_id)
);

create index if not exists idx_study_assignment_players_player on public.study_assignment_players(player_id);

create table if not exists public.mastery_quizzes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.study_assignments(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assignment_id)
);

create table if not exists public.mastery_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.mastery_quizzes(id) on delete cascade,
  question_text text not null,
  options jsonb not null,
  correct_index smallint not null check (correct_index >= 0),
  sort_order integer not null default 0
);

create index if not exists idx_mastery_questions_quiz on public.mastery_questions(quiz_id);

create table if not exists public.mastery_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.mastery_quizzes(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  score numeric(5,2) not null,
  taken_at timestamptz not null default now(),
  answers jsonb,
  unique (quiz_id, player_id)
);

create index if not exists idx_mastery_results_player on public.mastery_results(player_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.workout_sessions enable row level security;
alter table public.workout_attendance enable row level security;
alter table public.player_maxes enable row level security;
alter table public.study_packs enable row level security;
alter table public.study_pack_items enable row level security;
alter table public.study_assignments enable row level security;
alter table public.study_assignment_items enable row level security;
alter table public.study_assignment_players enable row level security;
alter table public.mastery_quizzes enable row level security;
alter table public.mastery_questions enable row level security;
alter table public.mastery_results enable row level security;

-- Service role (API)
drop policy if exists workout_sessions_service on public.workout_sessions;
create policy workout_sessions_service on public.workout_sessions for all using (true) with check (true);
drop policy if exists workout_attendance_service on public.workout_attendance;
create policy workout_attendance_service on public.workout_attendance for all using (true) with check (true);
drop policy if exists player_maxes_service on public.player_maxes;
create policy player_maxes_service on public.player_maxes for all using (true) with check (true);
drop policy if exists study_packs_service on public.study_packs;
create policy study_packs_service on public.study_packs for all using (true) with check (true);
drop policy if exists study_pack_items_service on public.study_pack_items;
create policy study_pack_items_service on public.study_pack_items for all using (true) with check (true);
drop policy if exists study_assignments_service on public.study_assignments;
create policy study_assignments_service on public.study_assignments for all using (true) with check (true);
drop policy if exists study_assignment_items_service on public.study_assignment_items;
create policy study_assignment_items_service on public.study_assignment_items for all using (true) with check (true);
drop policy if exists study_assignment_players_service on public.study_assignment_players;
create policy study_assignment_players_service on public.study_assignment_players for all using (true) with check (true);
drop policy if exists mastery_quizzes_service on public.mastery_quizzes;
create policy mastery_quizzes_service on public.mastery_quizzes for all using (true) with check (true);
drop policy if exists mastery_questions_service on public.mastery_questions;
create policy mastery_questions_service on public.mastery_questions for all using (true) with check (true);
drop policy if exists mastery_results_service on public.mastery_results;
create policy mastery_results_service on public.mastery_results for all using (true) with check (true);

-- player_maxes: players read own rows only
drop policy if exists player_maxes_own_read on public.player_maxes;
create policy player_maxes_own_read on public.player_maxes
  for select to authenticated
  using (
    exists (
      select 1 from public.players p
      where p.id = player_maxes.player_id and p.user_id = auth.uid()
    )
  );

-- study_assignment_players + mastery_results: own player writes (status/time/score)
drop policy if exists study_assignment_players_own_update on public.study_assignment_players;
create policy study_assignment_players_own_update on public.study_assignment_players
  for update to authenticated
  using (
    exists (select 1 from public.players p where p.id = study_assignment_players.player_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.players p where p.id = study_assignment_players.player_id and p.user_id = auth.uid())
  );

drop policy if exists mastery_results_own_insert on public.mastery_results;
create policy mastery_results_own_insert on public.mastery_results
  for insert to authenticated
  with check (
    exists (select 1 from public.players p where p.id = mastery_results.player_id and p.user_id = auth.uid())
  );

drop policy if exists mastery_results_own_read on public.mastery_results;
create policy mastery_results_own_read on public.mastery_results
  for select to authenticated
  using (
    exists (select 1 from public.players p where p.id = mastery_results.player_id and p.user_id = auth.uid())
  );

drop policy if exists study_assignment_players_own_read on public.study_assignment_players;
create policy study_assignment_players_own_read on public.study_assignment_players
  for select to authenticated
  using (
    exists (select 1 from public.players p where p.id = study_assignment_players.player_id and p.user_id = auth.uid())
  );

drop policy if exists study_assignments_player_read on public.study_assignments;
create policy study_assignments_player_read on public.study_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.study_assignment_players sap
      join public.players p on p.id = sap.player_id
      where sap.assignment_id = study_assignments.id and p.user_id = auth.uid()
    )
  );

drop policy if exists study_assignment_items_player_read on public.study_assignment_items;
create policy study_assignment_items_player_read on public.study_assignment_items
  for select to authenticated
  using (
    exists (
      select 1 from public.study_assignment_players sap
      join public.players p on p.id = sap.player_id
      where sap.assignment_id = study_assignment_items.assignment_id and p.user_id = auth.uid()
    )
  );

drop policy if exists mastery_quizzes_player_read on public.mastery_quizzes;
create policy mastery_quizzes_player_read on public.mastery_quizzes
  for select to authenticated
  using (
    exists (
      select 1 from public.study_assignments sa
      join public.study_assignment_players sap on sap.assignment_id = sa.id
      join public.players p on p.id = sap.player_id
      where mastery_quizzes.assignment_id = sa.id and p.user_id = auth.uid()
    )
  );

drop policy if exists mastery_questions_player_read on public.mastery_questions;
create policy mastery_questions_player_read on public.mastery_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.mastery_quizzes mq
      join public.study_assignments sa on sa.id = mq.assignment_id
      join public.study_assignment_players sap on sap.assignment_id = sa.id
      join public.players p on p.id = sap.player_id
      where mastery_questions.quiz_id = mq.id and p.user_id = auth.uid()
    )
  );
