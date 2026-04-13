-- Program due collections: internal tracking only (not payment processing).
-- Same visibility as other fundraising financials (HC/AD read; primary HC write).

create table if not exists public.fundraising_due_collections (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  season_year integer not null,
  description text not null,
  amount_due numeric(14, 2) not null default 0 check (amount_due >= 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'collected')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fundraising_due_collections_team_season_idx
  on public.fundraising_due_collections (team_id, season_year);

comment on table public.fundraising_due_collections is
  'Coach-facing ledger of amounts owed to the program; tracking only — not invoicing or payment collection.';

alter table public.fundraising_due_collections enable row level security;

drop policy if exists fundraising_due_collections_select_financials on public.fundraising_due_collections;
drop policy if exists fundraising_due_collections_write_primary_hc on public.fundraising_due_collections;

create policy fundraising_due_collections_select_financials on public.fundraising_due_collections
  for select using (public.can_view_fundraising_financials (team_id));

create policy fundraising_due_collections_write_primary_hc on public.fundraising_due_collections
  for all
  using (public.is_primary_head_coach_for_team (team_id))
  with check (public.is_primary_head_coach_for_team (team_id));
