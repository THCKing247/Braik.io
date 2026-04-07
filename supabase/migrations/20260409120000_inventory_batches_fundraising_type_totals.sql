-- Equipment purchase batches, fundraising, pre-aggregated expense totals per item type

-- ---------------------------------------------------------------------------
-- equipment_batches: lifecycle tracking per (team, bucket, equipment type)
-- ---------------------------------------------------------------------------
create table if not exists public.equipment_batches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  inventory_bucket text not null,
  equipment_type text not null,
  quantity integer not null,
  purchase_date date,
  unit_cost numeric(12, 2) not null default 0,
  condition_at_purchase text not null default 'EXCELLENT',
  current_condition text not null default 'EXCELLENT',
  status text not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint equipment_batches_bucket_check check (
    inventory_bucket in ('Gear', 'Uniforms', 'Facilities', 'Training Room', 'Field')
  ),
  constraint equipment_batches_status_check check (
    status in ('active', 'phasing_out', 'retired')
  ),
  constraint equipment_batches_quantity_pos check (quantity > 0),
  constraint equipment_batches_unit_cost_nonneg check (unit_cost >= 0)
);

create index if not exists equipment_batches_team_bucket_type_idx
  on public.equipment_batches (team_id, inventory_bucket, equipment_type);

comment on table public.equipment_batches is 'Purchase batches per equipment type; retired batches excluded from active cost totals.';

alter table public.inventory_items
  add column if not exists equipment_batch_id uuid references public.equipment_batches(id) on delete set null;

create index if not exists inventory_items_equipment_batch_id_idx
  on public.inventory_items (equipment_batch_id)
  where equipment_batch_id is not null;

-- ---------------------------------------------------------------------------
-- inventory_type_totals: pre-aggregated line cost for Expenses tab (server-maintained)
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_type_totals (
  team_id uuid not null references public.teams(id) on delete cascade,
  inventory_bucket text not null,
  equipment_type text not null,
  total_line_cost numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (team_id, inventory_bucket, equipment_type),
  constraint inventory_type_totals_bucket_check check (
    inventory_bucket in ('Gear', 'Uniforms', 'Facilities', 'Training Room', 'Field')
  )
);

create index if not exists inventory_type_totals_team_idx on public.inventory_type_totals (team_id);

comment on table public.inventory_type_totals is 'Cached rollup for inventory expense by type; refreshed by API when costs or batches change.';

-- ---------------------------------------------------------------------------
-- Fundraising (ledger + payment reference links only — no payment processing)
-- ---------------------------------------------------------------------------
create table if not exists public.fundraising_budget (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_year integer not null,
  school_allocation numeric(14, 2),
  goal_amount numeric(14, 2),
  notes text,
  affiliate_url text,
  affiliate_label text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (team_id, season_year)
);

create table if not exists public.fundraising_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_year integer not null,
  source_type text not null,
  source_name text not null,
  amount numeric(14, 2) not null,
  received_date date not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fundraising_entries_source_check check (
    source_type in ('donation', 'advertisement_banner', 'game_program_ad')
  ),
  constraint fundraising_entries_amount_nonneg check (amount >= 0)
);

create index if not exists fundraising_entries_team_season_idx
  on public.fundraising_entries (team_id, season_year);

create table if not exists public.fundraising_payment_refs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  platform text not null,
  handle_or_url text not null,
  display_label text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fundraising_payment_refs_platform_check check (
    platform in ('cashapp', 'venmo', 'paypal', 'other')
  )
);

create index if not exists fundraising_payment_refs_team_idx on public.fundraising_payment_refs (team_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.equipment_batches enable row level security;
alter table public.inventory_type_totals enable row level security;
alter table public.fundraising_budget enable row level security;
alter table public.fundraising_entries enable row level security;
alter table public.fundraising_payment_refs enable row level security;

-- Helper: primary head coach (or team role head_coach) may edit sensitive inventory finance rows
create or replace function public.is_head_coach_for_team(team_id_param uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_id_param
      and tm.user_id = auth.uid()
      and tm.active = true
      and tm.role = 'head_coach'
  );
$$;

-- equipment_batches: coaches read; head coach writes
drop policy if exists equipment_batches_select_team on public.equipment_batches;
create policy equipment_batches_select_team on public.equipment_batches
  for select using (public.is_team_member(team_id));

drop policy if exists equipment_batches_write_head on public.equipment_batches;
create policy equipment_batches_write_head on public.equipment_batches
  for all using (public.is_head_coach_for_team(team_id))
  with check (public.is_head_coach_for_team(team_id));

-- inventory_type_totals: team staff read; head coach + service patterns via API
drop policy if exists inventory_type_totals_select_team on public.inventory_type_totals;
create policy inventory_type_totals_select_team on public.inventory_type_totals
  for select using (public.is_team_member(team_id));

drop policy if exists inventory_type_totals_write_head on public.inventory_type_totals;
create policy inventory_type_totals_write_head on public.inventory_type_totals
  for all using (public.is_head_coach_for_team(team_id))
  with check (public.is_head_coach_for_team(team_id));

-- fundraising_budget
drop policy if exists fundraising_budget_select_coaches on public.fundraising_budget;
create policy fundraising_budget_select_coaches on public.fundraising_budget
  for select using (
    public.is_team_member(team_id)
    or exists (
      select 1 from public.teams t
      join public.program_members pm on pm.program_id = t.program_id and pm.active = true
      where t.id = fundraising_budget.team_id
        and pm.user_id = auth.uid()
        and pm.role = 'athletic_director'
    )
  );

drop policy if exists fundraising_budget_write_head on public.fundraising_budget;
create policy fundraising_budget_write_head on public.fundraising_budget
  for all using (public.is_head_coach_for_team(team_id))
  with check (public.is_head_coach_for_team(team_id));

-- fundraising_entries
drop policy if exists fundraising_entries_select_coaches on public.fundraising_entries;
create policy fundraising_entries_select_coaches on public.fundraising_entries
  for select using (
    public.is_team_member(team_id)
    or exists (
      select 1 from public.teams t
      join public.program_members pm on pm.program_id = t.program_id and pm.active = true
      where t.id = fundraising_entries.team_id
        and pm.user_id = auth.uid()
        and pm.role = 'athletic_director'
    )
  );

drop policy if exists fundraising_entries_write_head on public.fundraising_entries;
create policy fundraising_entries_write_head on public.fundraising_entries
  for all using (public.is_head_coach_for_team(team_id))
  with check (public.is_head_coach_for_team(team_id));

-- fundraising_payment_refs
drop policy if exists fundraising_payment_refs_select_coaches on public.fundraising_payment_refs;
create policy fundraising_payment_refs_select_coaches on public.fundraising_payment_refs
  for select using (public.is_team_member(team_id));

drop policy if exists fundraising_payment_refs_write_head on public.fundraising_payment_refs;
create policy fundraising_payment_refs_write_head on public.fundraising_payment_refs
  for all using (public.is_head_coach_for_team(team_id))
  with check (public.is_head_coach_for_team(team_id));
