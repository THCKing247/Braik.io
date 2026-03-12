-- Equipment Inventory Enhancements
-- Add equipment_type field to track preset vs custom equipment
-- Add availability tracking

-- Add equipment_type column to inventory_items
alter table public.inventory_items
add column if not exists equipment_type text;

-- Add index for equipment_type lookups
create index if not exists idx_inventory_items_equipment_type 
on public.inventory_items(equipment_type) 
where equipment_type is not null;

-- Update existing items to have a default equipment_type based on category
-- This is a one-time migration for existing data
update public.inventory_items
set equipment_type = upper(replace(category, ' ', '_'))
where equipment_type is null;

-- Add comment for documentation
comment on column public.inventory_items.equipment_type is 
'Equipment type: preset value from predefined list (e.g., HELMET, PADS) or CUSTOM for user-defined equipment';
