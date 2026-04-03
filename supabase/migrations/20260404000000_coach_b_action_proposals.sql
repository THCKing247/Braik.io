-- Durable Coach B pending tool confirmations (serverless / multi-instance safe).

create table if not exists public.coach_b_action_proposals (
  id uuid primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'executed', 'rejected')),
  input_source text not null default 'text',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coach_b_proposals_user_team_status
  on public.coach_b_action_proposals (user_id, team_id, status);

create index if not exists idx_coach_b_proposals_created
  on public.coach_b_action_proposals (created_at desc);

comment on table public.coach_b_action_proposals is 'Coach B tool proposals awaiting confirm; survives serverless cold starts.';
