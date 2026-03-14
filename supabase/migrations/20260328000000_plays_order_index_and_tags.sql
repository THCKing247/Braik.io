-- Play ordering and tags for productivity: order_index for drag-and-drop order, tags for filtering/search.
-- order_index: nullable integer; sort by order_index nulls last, then name.
-- tags: array of text for starter + custom tags (Run, Pass, RPO, Red Zone, etc.).

alter table public.plays
  add column if not exists order_index integer;

alter table public.plays
  add column if not exists tags text[] default '{}';

create index if not exists idx_plays_order_index on public.plays(playbook_id, formation_id, order_index nulls last)
  where playbook_id is not null;

comment on column public.plays.order_index is 'Display order within playbook/formation; null = sort by name.';
comment on column public.plays.tags is 'Optional tags for filtering: Run, Pass, RPO, Red Zone, 3rd Down, etc.';
