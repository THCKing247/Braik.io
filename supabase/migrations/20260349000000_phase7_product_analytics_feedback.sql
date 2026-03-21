-- Phase 7: privacy-conscious product analytics, structured feedback, internal reminder queue foundations.
-- Inserts use service role from API routes (existing pattern). No PII in event payloads by convention.

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_category text not null default 'product'
    check (event_category in ('marketing', 'product', 'coach_b', 'billing')),
  organization_id uuid references public.organizations(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  role text,
  source text not null default 'client' check (source in ('client', 'server')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_events_name_created on public.product_events (event_name, created_at desc);
create index if not exists idx_product_events_category_created on public.product_events (event_category, created_at desc);
create index if not exists idx_product_events_team_created on public.product_events (team_id, created_at desc) where team_id is not null;
create index if not exists idx_product_events_user_created on public.product_events (user_id, created_at desc) where user_id is not null;
create index if not exists idx_product_events_created on public.product_events (created_at desc);

alter table public.product_events enable row level security;

drop policy if exists product_events_service_role on public.product_events;
create policy product_events_service_role on public.product_events
  for all using (true) with check (true);

comment on table public.product_events is 'Append-only product/adoption events; keep metadata minimal and free of sensitive content.';

-- Legacy marketing sink (optional); /api/analytics/track also writes product_events with category marketing.
create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketing_events_created on public.marketing_events (created_at desc);

alter table public.marketing_events enable row level security;

drop policy if exists marketing_events_service_role on public.marketing_events;
create policy marketing_events_service_role on public.marketing_events
  for all using (true) with check (true);

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  category text not null
    check (category in ('bug', 'feature_request', 'support_question', 'general')),
  subject text,
  body text not null,
  page_path text,
  user_role text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_feedback_created on public.user_feedback (created_at desc);
create index if not exists idx_user_feedback_user on public.user_feedback (user_id, created_at desc);

alter table public.user_feedback enable row level security;

drop policy if exists user_feedback_service_role on public.user_feedback;
create policy user_feedback_service_role on public.user_feedback
  for all using (true) with check (true);

comment on table public.user_feedback is 'In-app feedback and support requests; admin review via service role APIs only.';

-- Queue-ready rows for future reminder/nudge jobs (no outbound sends from this migration).
create table if not exists public.internal_reminder_queue (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  signal_key text not null,
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_internal_reminder_queue_pending
  on public.internal_reminder_queue (status, created_at)
  where status = 'pending';

alter table public.internal_reminder_queue enable row level security;

drop policy if exists internal_reminder_queue_service_role on public.internal_reminder_queue;
create policy internal_reminder_queue_service_role on public.internal_reminder_queue
  for all using (true) with check (true);

comment on table public.internal_reminder_queue is 'Internal-only reminder eligibility backlog; populate via jobs/cron later—do not send user notifications from here until product is ready.';
