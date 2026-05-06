-- Inbox list: per-thread message totals and unread-from-others counts without transferring every row.
-- Matches app/api/messages/threads/route.ts prior JS aggregation (deleted_at null, sender <> viewer, last_read_at).

create or replace function public.message_thread_inbox_stats(
  p_thread_ids uuid[],
  p_user_id uuid
)
returns table (
  thread_id uuid,
  message_count bigint,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with thread_list as (
    select distinct unnest(p_thread_ids) as thread_id
  ),
  reads as (
    select mtp.thread_id, mtp.last_read_at
    from public.message_thread_participants mtp
    where mtp.user_id = p_user_id
      and mtp.thread_id = any (p_thread_ids)
  )
  select
    tl.thread_id,
    coalesce(count(m.id) filter (where m.deleted_at is null), 0)::bigint as message_count,
    coalesce(
      count(m.id) filter (
        where m.deleted_at is null
          and m.sender_id <> p_user_id
          and (
            r.last_read_at is null
            or m.created_at > r.last_read_at
          )
      ),
      0
    )::bigint as unread_count
  from thread_list tl
  left join reads r on r.thread_id = tl.thread_id
  left join public.messages m on m.thread_id = tl.thread_id
  group by tl.thread_id, r.last_read_at;
$$;

comment on function public.message_thread_inbox_stats(uuid[], uuid) is
  'Per-thread message totals and unread-from-others counts for messaging inbox (matches legacy JS unread rules).';

grant execute on function public.message_thread_inbox_stats(uuid[], uuid) to service_role;
grant execute on function public.message_thread_inbox_stats(uuid[], uuid) to authenticated;
