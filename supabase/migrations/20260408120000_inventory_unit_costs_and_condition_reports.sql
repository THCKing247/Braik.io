-- Unit costs per (team, bucket, equipment type) + audit trail + condition report workflow

create table if not exists public.inventory_unit_costs (
  team_id uuid not null references public.teams(id) on delete cascade,
  inventory_bucket text not null,
  equipment_type text not null,
  unit_cost numeric(12, 2),
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (team_id, inventory_bucket, equipment_type),
  constraint inventory_unit_costs_bucket_check check (
    inventory_bucket in ('Gear', 'Uniforms', 'Facilities', 'Training Room', 'Field')
  ),
  constraint inventory_unit_costs_unit_cost_nonneg check (unit_cost is null or unit_cost >= 0)
);

create index if not exists inventory_unit_costs_team_idx on public.inventory_unit_costs (team_id);

create table if not exists public.inventory_unit_cost_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  inventory_bucket text not null,
  equipment_type text not null,
  previous_cost numeric(12, 2),
  new_cost numeric(12, 2),
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_unit_cost_events_bucket_check check (
    inventory_bucket in ('Gear', 'Uniforms', 'Facilities', 'Training Room', 'Field')
  )
);

create index if not exists inventory_unit_cost_events_team_created_idx
  on public.inventory_unit_cost_events (team_id, created_at desc);

create table if not exists public.inventory_condition_reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reported_condition text not null,
  note text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint inventory_condition_reports_status_check check (
    status in ('pending', 'approved', 'dismissed')
  ),
  constraint inventory_condition_reports_condition_check check (
    reported_condition in ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'NEEDS_REPLACEMENT')
  )
);

create index if not exists inventory_condition_reports_team_status_idx
  on public.inventory_condition_reports (team_id, status);
create index if not exists inventory_condition_reports_item_idx
  on public.inventory_condition_reports (item_id);

comment on table public.inventory_unit_costs is 'Coach budget: one unit cost per equipment type within a bucket for a team.';
comment on table public.inventory_condition_reports is 'Condition change proposals; assistants submit, primary head coach approves/dismisses.';

alter table public.inventory_unit_costs enable row level security;
alter table public.inventory_unit_cost_events enable row level security;
alter table public.inventory_condition_reports enable row level security;

-- RLS: team staff can read; coaches with roster edit can manage unit costs; condition reports follow same read, insert for reporters, update restricted (API uses service role for fine checks)
create policy inventory_unit_costs_select_team on public.inventory_unit_costs
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = inventory_unit_costs.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
    )
  );

create policy inventory_unit_costs_write_team_coach on public.inventory_unit_costs
  for all using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = inventory_unit_costs.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('head_coach', 'assistant_coach', 'team_admin', 'trainer', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = inventory_unit_costs.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('head_coach', 'assistant_coach', 'team_admin', 'trainer', 'manager')
    )
  );

create policy inventory_unit_cost_events_select_team on public.inventory_unit_cost_events
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = inventory_unit_cost_events.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
    )
  );

create policy inventory_unit_cost_events_insert_team on public.inventory_unit_cost_events
  for insert with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = inventory_unit_cost_events.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
    )
  );

create policy inventory_condition_reports_select_team on public.inventory_condition_reports
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = inventory_condition_reports.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
    )
  );

create policy inventory_condition_reports_insert_coaches on public.inventory_condition_reports
  for insert with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = inventory_condition_reports.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('head_coach', 'assistant_coach', 'team_admin', 'trainer', 'manager')
    )
  );

create policy inventory_condition_reports_update_primary_hc on public.inventory_condition_reports
  for update using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = inventory_condition_reports.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role = 'head_coach'
        and coalesce(tm.is_primary, true) = true
    )
  )
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = inventory_condition_reports.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role = 'head_coach'
        and coalesce(tm.is_primary, true) = true
    )
  );
