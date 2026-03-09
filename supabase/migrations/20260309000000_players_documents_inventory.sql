-- Players (roster), documents, and inventory for dashboard GET APIs
-- Used by RosterManagerEnhanced, DocumentsManager, InventoryManager

-- Players: team roster
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  grade integer,
  jersey_number integer,
  position_group text,
  status text not null default 'active',
  notes text,
  image_url text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_players_team_id on public.players(team_id);
create index if not exists idx_players_user_id on public.players(user_id) where user_id is not null;
alter table public.players enable row level security;

-- Documents: team documents (waivers, playbooks, etc.)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  file_name text not null,
  file_url text,
  file_size bigint,
  mime_type text,
  category text not null default 'other',
  folder text,
  visibility text not null default 'all',
  scoped_unit text,
  scoped_position_groups jsonb,
  assigned_player_ids jsonb,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_team_id on public.documents(team_id);
create index if not exists idx_documents_created_by on public.documents(created_by);
alter table public.documents enable row level security;

-- Document acknowledgements (optional: for tracking who viewed/signed)
create table if not exists public.document_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(document_id, user_id)
);

create index if not exists idx_document_acknowledgements_document_id on public.document_acknowledgements(document_id);
alter table public.document_acknowledgements enable row level security;

-- Inventory items: team equipment
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  category text not null,
  name text not null,
  quantity_total integer not null default 0,
  quantity_available integer not null default 0,
  condition text not null default 'GOOD',
  assigned_to_player_id uuid references public.players(id) on delete set null,
  notes text,
  status text not null default 'AVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_items_team_id on public.inventory_items(team_id);
create index if not exists idx_inventory_items_assigned on public.inventory_items(assigned_to_player_id) where assigned_to_player_id is not null;
alter table public.inventory_items enable row level security;

-- RLS: allow service role full access (API uses service role)
drop policy if exists players_service_role on public.players;
create policy players_service_role on public.players for all using (true) with check (true);

drop policy if exists documents_service_role on public.documents;
create policy documents_service_role on public.documents for all using (true) with check (true);

drop policy if exists document_acknowledgements_service_role on public.document_acknowledgements;
create policy document_acknowledgements_service_role on public.document_acknowledgements for all using (true) with check (true);

drop policy if exists inventory_items_service_role on public.inventory_items;
create policy inventory_items_service_role on public.inventory_items for all using (true) with check (true);
