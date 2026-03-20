-- Inventory: coach bucket categories, cost tracking, player damage notes (minimal, backward-compatible)
alter table public.inventory_items add column if not exists inventory_bucket text;
alter table public.inventory_items add column if not exists cost_per_unit numeric(12, 2);
alter table public.inventory_items add column if not exists cost_notes text;
alter table public.inventory_items add column if not exists cost_updated_at timestamptz;
alter table public.inventory_items add column if not exists damage_report_text text;
alter table public.inventory_items add column if not exists damage_reported_at timestamptz;
alter table public.inventory_items add column if not exists damage_reported_by_player_id uuid references public.players(id) on delete set null;

update public.inventory_items
set inventory_bucket = 'Gear'
where inventory_bucket is null;

alter table public.inventory_items alter column inventory_bucket set default 'Gear';
alter table public.inventory_items alter column inventory_bucket set not null;

alter table public.inventory_items drop constraint if exists inventory_items_inventory_bucket_check;
alter table public.inventory_items add constraint inventory_items_inventory_bucket_check check (
  inventory_bucket in ('Gear', 'Uniforms', 'Facilities', 'Training Room', 'Field')
);

comment on column public.inventory_items.inventory_bucket is 'High-level inventory category for filtering and expense rollup.';
comment on column public.inventory_items.cost_per_unit is 'Coach expense: cost per unit (not sales).';
comment on column public.inventory_items.damage_report_text is 'Player-submitted damage / issue note for assigned equipment.';
