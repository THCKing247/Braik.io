-- Composite index for team schedule / stats games list: filter by team_id and order/filter on game_date (kickoff).
create index if not exists idx_games_team_kickoff on public.games (team_id, game_date);
