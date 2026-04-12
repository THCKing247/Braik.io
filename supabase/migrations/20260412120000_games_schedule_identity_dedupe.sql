-- Deduplicate legacy schedule rows, then enforce one row per (team, opponent, kickoff).
-- Opponent matching is case- and outer-whitespace-insensitive (matches app + CSV import).

-- 1) If duplicate GAME-linked events ever existed before the partial unique index, keep one per linked_game_id.
delete from public.events e
where e.linked_game_id is not null
  and exists (
    select 1
    from public.events e2
    where e2.linked_game_id = e.linked_game_id
      and e2.id < e.id
  );

-- 2) Merge duplicate games: keep earliest created row per (team_id, normalized opponent, game_date).
do $$
declare
  grp record;
  keeper uuid;
  dup_id uuid;
  dup_ids uuid[];
  i int;
begin
  for grp in
    select
      team_id,
      lower(trim(coalesce(opponent, ''))) as onorm,
      game_date,
      array_agg(id order by created_at asc nulls last, id asc) as ids
    from public.games
    group by team_id, lower(trim(coalesce(opponent, ''))), game_date
    having count(*) > 1
  loop
    dup_ids := grp.ids;
    keeper := dup_ids[1];
    for i in 2..coalesce(array_length(dup_ids, 1), 1) loop
      dup_id := dup_ids[i];
      update public.player_game_stats p
      set game_id = keeper
      where p.game_id = dup_id
        and not exists (
          select 1 from public.player_game_stats x
          where x.game_id = keeper and x.player_id = p.player_id
        );
      delete from public.player_game_stats where game_id = dup_id;
      update public.play_call_results set game_id = keeper where game_id = dup_id;
      update public.player_weekly_stat_entries set game_id = keeper where game_id = dup_id;
      delete from public.games where id = dup_id;
    end loop;
  end loop;
end $$;

-- 3) Unique schedule identity (import idempotency + manual duplicate prevention).
create unique index if not exists idx_games_team_schedule_identity
  on public.games (team_id, (lower(trim(coalesce(opponent, '')))), game_date);

comment on index public.idx_games_team_schedule_identity is
  'One scheduled game per team, opponent (case-insensitive), and kickoff instant.';
