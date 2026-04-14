-- Inbox per-thread stats: unread baseline = coalesce(last_read_at, joined_at, thread.created_at)
-- Team-wide sum of thread unreads for nav badges
-- Idempotent backfill: participant rows for every distinct message sender per thread
--
-- Realtime (optional): In Supabase Dashboard → Database → Replication, include `message_thread_participants`
-- so clients can subscribe to UPDATEs on the current user's row (cross-device read sync).
-- API routes use the service role and are not limited by RLS.

-- ---------------------------------------------------------------------------
-- Backfill senders (idempotent; complements creator backfill in prior migrations)
-- ---------------------------------------------------------------------------
insert into public.message_thread_participants (thread_id, user_id, joined_at)
select m.thread_id, m.sender_id, min(m.created_at)
from public.messages m
where m.deleted_at is null
  and m.sender_id is not null
group by m.thread_id, m.sender_id
on conflict (thread_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Per-thread inbox stats (RPC used by GET /api/messages/threads)
-- ---------------------------------------------------------------------------
create or replace function public.message_threads_inbox_stats(
  p_user_id uuid,
  p_thread_ids uuid[]
)
returns table (
  thread_id uuid,
  message_count bigint,
  unread_count bigint,
  last_message_id uuid,
  last_message_content text,
  last_message_created_at timestamptz,
  last_sender_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  with parts as (
    select
      mtp.thread_id,
      mtp.last_read_at,
      mtp.joined_at,
      mt.created_at as thread_created_at
    from public.message_thread_participants mtp
    inner join public.message_threads mt on mt.id = mtp.thread_id
    where mtp.user_id = p_user_id
      and mtp.thread_id = any(p_thread_ids)
  ),
  msg_counts as (
    select m.thread_id, count(*)::bigint as cnt
    from public.messages m
    where m.thread_id = any(p_thread_ids)
      and m.deleted_at is null
    group by m.thread_id
  ),
  unread as (
    select m.thread_id, count(*)::bigint as cnt
    from public.messages m
    inner join parts p on p.thread_id = m.thread_id
    where m.thread_id = any(p_thread_ids)
      and m.deleted_at is null
      and m.sender_id <> p_user_id
      and m.created_at > coalesce(p.last_read_at, p.joined_at, p.thread_created_at)
    group by m.thread_id
  ),
  latest as (
    select distinct on (m.thread_id)
      m.thread_id,
      m.id as lm_id,
      m.content as lm_content,
      m.created_at as lm_created_at,
      m.sender_id as lm_sender_id
    from public.messages m
    where m.thread_id = any(p_thread_ids)
      and m.deleted_at is null
    order by m.thread_id, m.created_at desc
  )
  select
    tid,
    coalesce(mc.cnt, 0::bigint),
    coalesce(u.cnt, 0::bigint),
    l.lm_id,
    l.lm_content,
    l.lm_created_at,
    l.lm_sender_id
  from unnest(p_thread_ids) as tid
  left join msg_counts mc on mc.thread_id = tid
  left join unread u on u.thread_id = tid
  left join latest l on l.thread_id = tid;
$$;

grant execute on function public.message_threads_inbox_stats(uuid, uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- Total unread across all threads in a team for one user (nav badge)
-- ---------------------------------------------------------------------------
create or replace function public.messaging_unread_total_for_team_user(
  p_user_id uuid,
  p_team_id uuid
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  with parts as (
    select
      mtp.thread_id,
      mtp.last_read_at,
      mtp.joined_at,
      mt.created_at as thread_created_at
    from public.message_thread_participants mtp
    inner join public.message_threads mt on mt.id = mtp.thread_id
    where mtp.user_id = p_user_id
      and mt.team_id = p_team_id
  ),
  unread as (
    select m.thread_id, count(*)::bigint as cnt
    from public.messages m
    inner join parts p on p.thread_id = m.thread_id
    where m.deleted_at is null
      and m.sender_id <> p_user_id
      and m.created_at > coalesce(p.last_read_at, p.joined_at, p.thread_created_at)
    group by m.thread_id
  )
  select coalesce(sum(u.cnt), 0::bigint) from unread u;
$$;

grant execute on function public.messaging_unread_total_for_team_user(uuid, uuid) to service_role;
