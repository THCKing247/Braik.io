-- One-time cleanup: remove duplicate calendar events and duplicate games (same team + opponent + kickoff).
-- Kickoff is stored as games.game_date (timestamptz); there is no separate game_time column.
-- Safe to re-run: if data is already unique, counts are zero and body is a no-op.
-- Does NOT run on application requests — migration only.

-- ─── 1) Duplicate events: at most one row per linked_game_id (keep earliest created_at, then smallest id) ───
DO $$
DECLARE
  n_excess int;
  n_deleted int;
BEGIN
  -- Rows beyond one per linked_game_id (same game linked multiple times in calendar).
  SELECT
    coalesce(
      (SELECT count(*)::int FROM public.events WHERE linked_game_id IS NOT NULL),
      0
    ) - coalesce(
      (SELECT count(DISTINCT linked_game_id)::int FROM public.events WHERE linked_game_id IS NOT NULL),
      0
    )
  INTO n_excess;

  DELETE FROM public.events e
  WHERE e.linked_game_id IS NOT NULL
    AND e.id NOT IN (
      SELECT sub.id
      FROM (
        SELECT DISTINCT ON (sub2.linked_game_id) sub2.id
        FROM public.events sub2
        WHERE sub2.linked_game_id IS NOT NULL
        ORDER BY sub2.linked_game_id, sub2.created_at ASC NULLS LAST, sub2.id ASC
      ) sub
    );

  GET DIAGNOSTICS n_deleted = ROW_COUNT;
  RAISE NOTICE '[one_time_cleanup] events: excess rows (before) = %, rows deleted = %', n_excess, n_deleted;
END $$;

-- ─── 2) Duplicate games: same identity as app — team_id + normalized opponent + game_date (kickoff instant) ───
DO $$
DECLARE
  grp record;
  keeper uuid;
  dup_id uuid;
  dup_ids uuid[];
  i int;
  len int;
  n_groups int := 0;
  n_games_removed int := 0;
  teams text;
  sample_dates text;
BEGIN
  SELECT count(*) INTO n_groups
  FROM (
    select team_id, lower(trim(coalesce(opponent, ''))) as onorm, game_date
    from public.games
    group by team_id, lower(trim(coalesce(opponent, ''))), game_date
    having count(*) > 1
  ) d;

  IF n_groups = 0 THEN
    RAISE NOTICE '[one_time_cleanup] games: no duplicate groups (team + opponent + game_date)';
  ELSE
  BEGIN
  SELECT string_agg(distinct team_id::text, ', ' ORDER BY team_id::text)
  INTO teams
  FROM (
    select team_id
    from public.games
    group by team_id, lower(trim(coalesce(opponent, ''))), game_date
    having count(*) > 1
  ) x;

  SELECT string_agg(dt, ', ' ORDER BY dt)
  INTO sample_dates
  FROM (
    select distinct game_date::text as dt
    from public.games
    group by team_id, lower(trim(coalesce(opponent, ''))), game_date
    having count(*) > 1
    limit 25
  ) y;

  RAISE NOTICE '[one_time_cleanup] games: duplicate groups = %, affected team_id(s) = %', n_groups, teams;
  RAISE NOTICE '[one_time_cleanup] games: sample game_date values (up to 25) = %', sample_dates;

  FOR grp IN
    SELECT
      team_id,
      lower(trim(coalesce(opponent, ''))) AS onorm,
      game_date,
      array_agg(id ORDER BY created_at ASC NULLS LAST, id ASC) AS ids
    FROM public.games
    GROUP BY team_id, lower(trim(coalesce(opponent, ''))), game_date
    HAVING count(*) > 1
  LOOP
    dup_ids := grp.ids;
    len := coalesce(array_length(dup_ids, 1), 0);
    IF len < 2 THEN
      CONTINUE;
    END IF;
    keeper := dup_ids[1];
    RAISE NOTICE '[one_time_cleanup] games: merging group team_id=% game_date=% keeper_id=% dup_count=%',
      grp.team_id, grp.game_date, keeper, len - 1;

    FOR i IN 2..len LOOP
      dup_id := dup_ids[i];
      UPDATE public.player_game_stats p
      SET game_id = keeper
      WHERE p.game_id = dup_id
        AND NOT EXISTS (
          SELECT 1 FROM public.player_game_stats x
          WHERE x.game_id = keeper AND x.player_id = p.player_id
        );
      DELETE FROM public.player_game_stats WHERE game_id = dup_id;
      UPDATE public.play_call_results SET game_id = keeper WHERE game_id = dup_id;
      UPDATE public.player_weekly_stat_entries SET game_id = keeper WHERE game_id = dup_id;
      DELETE FROM public.games WHERE id = dup_id;
      n_games_removed := n_games_removed + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[one_time_cleanup] games: total duplicate game rows removed = %', n_games_removed;
  END;
  END IF;
END $$;

-- Ensure schedule uniqueness if an older migration was not applied (idempotent).
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_team_schedule_identity
  ON public.games (team_id, (lower(trim(coalesce(opponent, '')))), game_date);

COMMENT ON INDEX public.idx_games_team_schedule_identity IS
  'One scheduled game per team, opponent (case-insensitive), and kickoff instant.';
