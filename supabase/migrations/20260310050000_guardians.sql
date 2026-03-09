-- Guardians and Guardian Links: parent-player relationships
-- Supports parent accounts linking to player accounts for high school teams

-- Guardians: parent/guardian user accounts
create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  email text,
  relationship text, -- 'parent', 'guardian', 'other'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create index if not exists idx_guardians_user_id on public.guardians(user_id);
alter table public.guardians enable row level security;

-- Guardian links: many-to-many relationship between guardians and players
create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  relationship text, -- 'parent', 'guardian', 'other'
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(guardian_id, player_id)
);

create index if not exists idx_guardian_links_guardian_id on public.guardian_links(guardian_id);
create index if not exists idx_guardian_links_player_id on public.guardian_links(player_id);
alter table public.guardian_links enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists guardians_service_role on public.guardians;
create policy guardians_service_role on public.guardians for all using (true) with check (true);

drop policy if exists guardian_links_service_role on public.guardian_links;
create policy guardian_links_service_role on public.guardian_links for all using (true) with check (true);
