-- Seasons and Games: team season management and game records
-- Supports season tracking, game scheduling, and record keeping

-- Seasons: team seasons with division, conference, and playoff info
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  year integer not null,
  name text, -- e.g., "2024 Fall Season"
  division text, -- e.g., "5A", "Division I"
  conference text, -- e.g., "Big 12", "Metro Conference"
  playoff_ruleset text, -- Playoff qualification rules
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, year)
);

create index if not exists idx_seasons_team_id on public.seasons(team_id);
create index if not exists idx_seasons_year on public.seasons(year desc);
alter table public.seasons enable row level security;

-- Games: individual games within seasons
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  opponent text,
  game_date timestamptz not null,
  location text,
  game_type text, -- 'regular', 'playoff', 'scrimmage', 'tournament'
  conference_game boolean not null default false,
  result text, -- 'win', 'loss', 'tie', null if not played yet
  team_score integer,
  opponent_score integer,
  confirmed_by_coach boolean not null default false,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_games_season_id on public.games(season_id);
create index if not exists idx_games_team_id on public.games(team_id);
create index if not exists idx_games_game_date on public.games(game_date);
create index if not exists idx_games_confirmed on public.games(confirmed_by_coach, result) where confirmed_by_coach = true and result is not null;
alter table public.games enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists seasons_service_role on public.seasons;
create policy seasons_service_role on public.seasons for all using (true) with check (true);

drop policy if exists games_service_role on public.games;
create policy games_service_role on public.games for all using (true) with check (true);
