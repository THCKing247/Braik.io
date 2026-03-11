-- Sub-formations: first-class categories under a formation (e.g. Singleback > Deuce Close).
-- A play belongs to one formation and optionally one sub-formation under that formation.

create table if not exists public.sub_formations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  formation_id uuid not null references public.formations(id) on delete cascade,
  side text not null check (side in ('offense', 'defense', 'special_teams')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sub_formations_team_id on public.sub_formations(team_id);
create index if not exists idx_sub_formations_formation_id on public.sub_formations(formation_id);
create index if not exists idx_sub_formations_side on public.sub_formations(side);

alter table public.sub_formations enable row level security;

-- Link plays to a sub-formation (nullable: plays can have formation only, or formation + sub-formation)
alter table public.plays
  add column if not exists sub_formation_id uuid references public.sub_formations(id) on delete set null;

create index if not exists idx_plays_sub_formation_id on public.plays(sub_formation_id) where sub_formation_id is not null;

-- RLS
drop policy if exists sub_formations_service_role on public.sub_formations;
create policy sub_formations_service_role on public.sub_formations for all using (true) with check (true);
