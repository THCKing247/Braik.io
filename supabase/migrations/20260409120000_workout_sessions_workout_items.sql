-- Structured workout plan per recurring session (lift + reps rows). Legacy `description` retained for reads.
alter table public.workout_sessions
  add column if not exists workout_items jsonb not null default '[]'::jsonb;

comment on column public.workout_sessions.workout_items is 'Array of { lift, reps } for coach-built workouts; legacy description may still exist for old rows.';
