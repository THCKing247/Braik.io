-- Reusable weight-room workout templates (team-scoped, coach-managed).

create table if not exists public.workout_presets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  default_title text,
  workout_items jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workout_presets_team on public.workout_presets(team_id);

comment on table public.workout_presets is 'Coach-saved workout templates (lift/reps rows + optional default session title).';

alter table public.workout_presets enable row level security;

drop policy if exists workout_presets_service on public.workout_presets;
create policy workout_presets_service on public.workout_presets for all using (true) with check (true);
