-- Plays and Playbooks: team play management
-- Supports playbook creation, organization, and play storage

-- Playbooks: collections of plays organized by team
create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  visibility text not null default 'team', -- 'team', 'offense', 'defense', 'special_teams'
  nodes jsonb not null default '{}'::jsonb, -- PlaybookNode structure
  root_by_side jsonb not null default '{}'::jsonb, -- Root nodes by side of ball
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_playbooks_team_id on public.playbooks(team_id);
create index if not exists idx_playbooks_visibility on public.playbooks(visibility);
alter table public.playbooks enable row level security;

-- Plays: individual plays that can belong to playbooks
create table if not exists public.plays (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  playbook_id uuid references public.playbooks(id) on delete set null,
  side text not null, -- 'offense', 'defense', 'special_teams'
  formation text not null,
  subcategory text,
  name text not null,
  canvas_data jsonb, -- Play canvas/drawing data
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plays_team_id on public.plays(team_id);
create index if not exists idx_plays_playbook_id on public.plays(playbook_id) where playbook_id is not null;
create index if not exists idx_plays_side on public.plays(side);
alter table public.plays enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists playbooks_service_role on public.playbooks;
create policy playbooks_service_role on public.playbooks for all using (true) with check (true);

drop policy if exists plays_service_role on public.plays;
create policy plays_service_role on public.plays for all using (true) with check (true);
