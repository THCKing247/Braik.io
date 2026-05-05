-- Speed GET /api/stats/weekly when filtering by team + season_year + week_number (partial: active rows only).
-- Confirmed table/columns from 20260356000000_player_weekly_stat_entries.sql and soft-delete migration.

create index if not exists idx_player_weekly_stat_entries_team_season_week_active
  on public.player_weekly_stat_entries (team_id, season_year, week_number)
  where deleted_at is null;
