-- Unread counts: only messages from others with created_at after last_read_at (or all if last_read_at is null).

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
      mtp.last_read_at
    from public.message_thread_participants mtp
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
      and (
        p.last_read_at is null
        or m.created_at > p.last_read_at
      )
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
