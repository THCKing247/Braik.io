-- Games + notifications: tighter indexes and a single-round-trip notifications feed.
-- Portal API uses the service-role client (RLS bypass); indexes still speed up planner choice.

-- games(team_id, game_date) already covered by idx_games_team_game_date / idx_games_team_kickoff — no duplicate btree.

-- Unread badge + unread-only lists: small partial index (common case: read = false)
create index if not exists idx_notifications_user_team_unread_created
  on public.notifications (user_id, team_id, created_at desc)
  where read = false;

-- Team-scoped ordering (admin/analytics-style filters); complements user-first index
create index if not exists idx_notifications_team_read_created
  on public.notifications (team_id, read, created_at desc);

comment on index public.idx_notifications_user_team_unread_created is
  'Unread inbox: user + team + created_at for read=false only.';

-- Single DB round-trip: list page + exact unread count (replaces parallel select + count).
-- Fetches limit+1 rows to compute hasMore, then trims to limit in JSON.
create or replace function public.notifications_feed_v1(
  p_user_id uuid,
  p_team_id uuid,
  p_unread_only boolean,
  p_limit int,
  p_offset int,
  p_since timestamptz
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with unread_c as (
    select count(*)::int as c
    from public.notifications n
    where n.user_id = p_user_id
      and n.team_id = p_team_id
      and n.read = false
  ),
  raw as (
    select n.*
    from public.notifications n
    where n.user_id = p_user_id
      and n.team_id = p_team_id
      and (not p_unread_only or n.read = false)
      and n.created_at >= p_since
    order by n.created_at desc
    limit p_limit + 1 offset p_offset
  ),
  numbered as (
    select r.*, row_number() over (order by r.created_at desc) as __rn
    from raw r
  )
  select jsonb_build_object(
    'unreadCount', (select c from unread_c),
    'hasMore', (select count(*) > p_limit from numbered),
    'notifications', coalesce(
      (
        select jsonb_agg(to_jsonb(t) - '__rn')
        from numbered t
        where t.__rn <= p_limit
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function public.notifications_feed_v1 is
  'Portal GET /api/notifications: one round-trip for list + unread count + hasMore.';

grant execute on function public.notifications_feed_v1(
  uuid, uuid, boolean, int, int, timestamptz
) to service_role;
