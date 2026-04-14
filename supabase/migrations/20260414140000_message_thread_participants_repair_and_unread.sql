-- Repair missing participant rows, fix unread baseline (last_read_at vs joined_at vs thread created_at),
-- and provide a per-team-user repair RPC for list loads.

-- ---------------------------------------------------------------------------
-- Backfill: thread creators + all message senders (idempotent)
-- ---------------------------------------------------------------------------
insert into public.message_thread_participants (thread_id, user_id, joined_at)
select mt.id, mt.created_by, mt.created_at
from public.message_threads mt
where mt.created_by is not null
on conflict (thread_id, user_id) do nothing;

insert into public.message_thread_participants (thread_id, user_id, joined_at)
select m.thread_id, m.sender_id, min(m.created_at)
from public.messages m
where m.deleted_at is null
  and m.sender_id is not null
group by m.thread_id, m.sender_id
on conflict (thread_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Inbox stats: unread = messages from others strictly after read baseline
-- baseline = coalesce(last_read_at, joined_at, thread.created_at)
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
-- Repair: insert missing participant row for current user when they created
-- the thread or have sent a message in that team (called on thread list load).
-- ---------------------------------------------------------------------------
create or replace function public.repair_missing_message_thread_participants_for_team_user(
  p_team_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  repair_inserted int;
begin
  insert into public.message_thread_participants (thread_id, user_id, joined_at)
  select mt.id, p_user_id, now()
  from public.message_threads mt
  where mt.team_id = p_team_id
    and (
      mt.created_by = p_user_id
      or exists (
        select 1
        from public.messages m
        where m.thread_id = mt.id
          and m.sender_id = p_user_id
          and m.deleted_at is null
      )
    )
    and not exists (
      select 1
      from public.message_thread_participants x
      where x.thread_id = mt.id
        and x.user_id = p_user_id
    )
  on conflict (thread_id, user_id) do nothing;

  get diagnostics repair_inserted = row_count;
  return coalesce(repair_inserted, 0);
end;
$$;

grant execute on function public.repair_missing_message_thread_participants_for_team_user(uuid, uuid) to service_role;
