-- Fragment match for developer console UUID search (internal admin tooling only).
-- Invoked server-side via service role; not exposed as arbitrary SQL to clients.

create or replace function public.admin_dev_console_uuid_fragment(fragment text)
returns table(source_table text, entity_id uuid)
language sql
stable
parallel safe
security invoker
set search_path = public
as $$
  select * from (
    select 'users'::text as source_table, u.id as entity_id
    from public.users u
    where length(trim(lower(coalesce(fragment, '')))) >= 8
      and u.id::text ilike '%' || trim(lower(fragment)) || '%'
    limit 15
  ) u
  union all
  select * from (
    select 'teams'::text, t.id
    from public.teams t
    where length(trim(lower(coalesce(fragment, '')))) >= 8
      and t.id::text ilike '%' || trim(lower(fragment)) || '%'
    limit 15
  ) t
  union all
  select * from (
    select 'subscriptions'::text, s.id
    from public.subscriptions s
    where length(trim(lower(coalesce(fragment, '')))) >= 8
      and s.id::text ilike '%' || trim(lower(fragment)) || '%'
    limit 15
  ) s;
$$;

comment on function public.admin_dev_console_uuid_fragment(text) is
  'Returns user/team/subscription id rows whose UUID text matches a fragment (min 8 chars). Used by admin dev-console.';
