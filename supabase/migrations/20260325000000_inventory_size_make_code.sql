-- Inventory Size, Make, and Unique Code
-- Add fields for equipment size, manufacturer, and unique item code

-- Add size and make columns to inventory_items
alter table public.inventory_items
add column if not exists size text,
add column if not exists make text,
add column if not exists item_code text;

-- Add index for item_code lookups
create index if not exists idx_inventory_items_item_code 
on public.inventory_items(item_code) 
where item_code is not null;

-- Add comment for documentation
comment on column public.inventory_items.size is 'Equipment size (e.g., Small, Medium, Large, XL, or specific measurements)';
comment on column public.inventory_items.make is 'Equipment manufacturer/brand (e.g., Riddell, Schutt, Nike)';
comment on column public.inventory_items.item_code is 'Unique identifier code for this specific item (for labeling/tracking)';
