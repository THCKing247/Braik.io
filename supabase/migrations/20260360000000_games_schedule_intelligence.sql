-- Schedule intelligence: cached AI recap + optional coach override for Player of the Game.
alter table public.games add column if not exists ai_recap text;
alter table public.games add column if not exists ai_recap_at timestamptz;
alter table public.games add column if not exists potg_override_player_id uuid references public.players(id) on delete set null;

comment on column public.games.ai_recap is 'Cached narrative recap; regenerate via API.';
comment on column public.games.potg_override_player_id is 'When set, display this player as Player of the Game instead of auto pick from player_game_stats.';

create index if not exists idx_games_potg_override on public.games(potg_override_player_id) where potg_override_player_id is not null;
