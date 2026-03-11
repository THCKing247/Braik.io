-- Formations: first-class reusable alignments (shapes only, no routes)
-- Plays can reference a formation via formation_id; formation name is still denormalized on plays for display.

create table if not exists public.formations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  playbook_id uuid references public.playbooks(id) on delete set null,
  side text not null check (side in ('offense', 'defense', 'special_teams')),
  name text not null,
  parent_formation_id uuid references public.formations(id) on delete set null,
  template_data jsonb not null default '{"fieldView":"HALF","shapes":[],"paths":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_formations_team_id on public.formations(team_id);
create index if not exists idx_formations_side on public.formations(side);
create index if not exists idx_formations_playbook_id on public.formations(playbook_id) where playbook_id is not null;
create index if not exists idx_formations_parent on public.formations(parent_formation_id) where parent_formation_id is not null;

alter table public.formations enable row level security;

-- Optional: link plays to a formation (for "play from formation")
alter table public.plays
  add column if not exists formation_id uuid references public.formations(id) on delete set null;

create index if not exists idx_plays_formation_id on public.plays(formation_id) where formation_id is not null;

-- RLS: service role full access (API uses service role)
drop policy if exists formations_service_role on public.formations;
create policy formations_service_role on public.formations for all using (true) with check (true);
