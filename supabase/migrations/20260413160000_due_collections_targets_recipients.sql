-- Due collections: recipient target flags + per-user contribution tracking (not payment processing).

alter table public.fundraising_due_collections
  add column if not exists target_all boolean not null default false,
  add column if not exists target_assistant_coaches boolean not null default false,
  add column if not exists target_players boolean not null default false,
  add column if not exists target_parents boolean not null default false;

comment on column public.fundraising_due_collections.amount_due is
  'Total collection goal; expected share per recipient is this amount divided by targeted count (tracking only).';

alter table public.fundraising_due_collections drop constraint if exists fundraising_due_collections_status_check;

update public.fundraising_due_collections
set status = 'completed'
where status = 'collected';

alter table public.fundraising_due_collections
  add constraint fundraising_due_collections_status_check check (status in ('pending', 'in_progress', 'completed'));

create table if not exists public.fundraising_due_collection_recipients (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.fundraising_due_collections (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_kind text not null check (role_kind in ('assistant_coach', 'player', 'parent')),
  player_id uuid references public.players (id) on delete set null,
  contribution_status text not null default 'pending' check (contribution_status in ('pending', 'collected')),
  received_note text,
  updated_at timestamptz not null default now(),
  unique (collection_id, user_id)
);

create index if not exists idx_fdc_recipients_collection on public.fundraising_due_collection_recipients (collection_id);
create index if not exists idx_fdc_recipients_team on public.fundraising_due_collection_recipients (team_id);

comment on table public.fundraising_due_collection_recipients is
  'Per-user contribution tracking for a due collection; coach-entered only — not payment processing.';

alter table public.fundraising_due_collection_recipients enable row level security;

drop policy if exists fdc_recipients_select_financials on public.fundraising_due_collection_recipients;
drop policy if exists fdc_recipients_write_primary_hc on public.fundraising_due_collection_recipients;

create policy fdc_recipients_select_financials on public.fundraising_due_collection_recipients
  for select using (public.can_view_fundraising_financials (team_id));

create policy fdc_recipients_write_primary_hc on public.fundraising_due_collection_recipients
  for all
  using (public.is_primary_head_coach_for_team (team_id))
  with check (public.is_primary_head_coach_for_team (team_id));
