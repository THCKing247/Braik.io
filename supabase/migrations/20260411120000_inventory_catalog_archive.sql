-- Catalog metadata per (team, bucket, equipment type) + row-level archive for inventory items.
-- Coach-facing queries filter archive_status = 'active' and exclude archived catalog types.

alter table public.inventory_items
  add column if not exists archive_status text not null default 'active';

alter table public.inventory_items
  drop constraint if exists inventory_items_archive_status_check;

alter table public.inventory_items
  add constraint inventory_items_archive_status_check check (archive_status in ('active', 'archived'));

create index if not exists inventory_items_team_archive_idx
  on public.inventory_items (team_id, archive_status)
  where archive_status = 'active';

comment on column public.inventory_items.archive_status is
  'Lifecycle: active (visible to coaches) vs archived (hidden; availability still in status column).';

-- Group-level settings and archive metadata (one row per team + bucket + equipment type key)
create table if not exists public.inventory_item_types (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  inventory_bucket text not null,
  equipment_type_key text not null,
  display_name text,
  icon_key text,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_item_types_bucket_check check (
    inventory_bucket in ('Gear', 'Uniforms', 'Facilities', 'Training Room', 'Field')
  ),
  unique (team_id, inventory_bucket, equipment_type_key)
);

create index if not exists inventory_item_types_team_idx on public.inventory_item_types (team_id);
create index if not exists inventory_item_types_team_active_idx
  on public.inventory_item_types (team_id)
  where archived_at is null;

comment on table public.inventory_item_types is
  'Optional display overrides and archive state for equipment type groups; items still keyed by equipment_type text.';

create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_platform_roles upr
    join public.platform_roles pr on pr.id = upr.role_id
    where upr.user_id = auth.uid()
      and pr.key = 'platform_admin'
  );
$$;

alter table public.inventory_item_types enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: mirror team inventory access; coaches never see archived rows via JWT paths
-- ---------------------------------------------------------------------------

drop policy if exists inventory_item_types_team_read on public.inventory_item_types;
create policy inventory_item_types_team_read on public.inventory_item_types
  for select using (
    public.is_team_member(team_id)
    and archived_at is null
  );

drop policy if exists inventory_item_types_platform_read_archived on public.inventory_item_types;
create policy inventory_item_types_platform_read_archived on public.inventory_item_types
  for select using (
    public.is_platform_operator()
  );

drop policy if exists inventory_item_types_team_write on public.inventory_item_types;
create policy inventory_item_types_team_write on public.inventory_item_types
  for all
  using (public.can_edit_roster(team_id))
  with check (public.can_edit_roster(team_id));

drop policy if exists inventory_item_types_service on public.inventory_item_types;
create policy inventory_item_types_service on public.inventory_item_types
  for all using (true) with check (true);

-- inventory_items: hide archived rows from team members (JWT), allow platform operator full read
drop policy if exists inventory_items_team_member_read on public.inventory_items;
create policy inventory_items_team_member_read on public.inventory_items
  for select using (
    (
      public.is_team_member(team_id)
      and coalesce(archive_status, 'active') = 'active'
    )
    or public.is_platform_operator()
  );

drop policy if exists inventory_items_team_member_update on public.inventory_items;
create policy inventory_items_team_member_update on public.inventory_items
  for update
  using (
    (
      public.can_edit_roster(team_id)
      and coalesce(archive_status, 'active') = 'active'
    )
    or public.is_platform_operator()
  )
  with check (
    public.can_edit_roster(team_id)
    or public.is_platform_operator()
  );

drop policy if exists inventory_items_team_member_delete on public.inventory_items;
create policy inventory_items_team_member_delete on public.inventory_items
  for delete
  using (
    (
      public.can_edit_roster(team_id)
      and coalesce(archive_status, 'active') = 'active'
    )
    or public.is_platform_operator()
  );
