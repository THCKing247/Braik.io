-- Dashboard shell: resolve athletic_department ordinals without loading every row into Node.
-- Ordering matches lib/navigation/organization-routes.ts sortByCreationThenId (null created_at → 0 ms).

create or replace function public.short_org_ordinals_for_athletic_department_ids(p_ids uuid[])
returns table (id uuid, ordinal bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select ranked.id, ranked.ordinal::bigint
  from (
    select
      ad.id,
      row_number() over (
        order by
          coalesce(extract(epoch from ad.created_at) * 1000, 0::double precision),
          ad.id::text
      ) as ordinal
    from public.athletic_departments ad
  ) ranked
  where ranked.id = any(p_ids);
$$;

comment on function public.short_org_ordinals_for_athletic_department_ids(uuid[]) is
  'Ordinal short org index for athletic_department IDs (1-based); matches dashboard shell TS sort.';

revoke all on function public.short_org_ordinals_for_athletic_department_ids(uuid[]) from public;
grant execute on function public.short_org_ordinals_for_athletic_department_ids(uuid[]) to service_role;
