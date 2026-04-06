-- Restrict hard DELETE on public.messages to school admins and platform admins (not head coaches).
-- API moderation uses the service role; this policy applies to JWT / direct client access.

create or replace function public.can_admin_moderate_messages(team_id_param uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_id_param
      and tm.user_id = auth.uid()
      and tm.active = true
      and tm.role = 'SCHOOL_ADMIN'
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(coalesce(u.role, '')) = 'admin'
  );
$$;

drop policy if exists messages_thread_participant_delete on public.messages;
create policy messages_thread_participant_delete on public.messages
  for delete
  using (
    exists (
      select 1
      from public.message_threads mt
      where mt.id = thread_id
        and public.can_admin_moderate_messages(mt.team_id)
    )
  );
