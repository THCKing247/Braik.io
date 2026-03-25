-- Fast team readiness counts (matches lib/readiness.ts: ready = profileComplete && requiredDocsComplete).
-- Used by GET /api/teams/[teamId]/readiness?summaryOnly=1 to avoid loading all documents/equipment/guardians.

create or replace function public.team_readiness_summary_minimal(p_team_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select
      id,
      trim(coalesce(first_name, '')) <> ''
        and trim(coalesce(last_name, '')) <> '' as has_name,
      coalesce(trim(player_phone::text), '') <> ''
        or coalesce(trim(email::text), '') <> ''
        or coalesce(trim(parent_guardian_contact::text), '') <> '' as has_contact
    from public.players
    where team_id = p_team_id
  ),
  doc_row_cats as (
    select
      pd.player_id,
      lower(
        trim(
          coalesce(
            nullif(trim(coalesce(pd.document_type::text, '')), ''),
            nullif(trim(coalesce(pd.category::text, '')), ''),
            'other'
          )
        )
      ) as cat
    from public.player_documents pd
    where pd.team_id = p_team_id
      and pd.deleted_at is null
      and (pd.expires_at is null or pd.expires_at > now())
  ),
  per_player as (
    select
      player_id,
      bool_or(cat = 'physical') as has_physical,
      bool_or(cat = 'waiver') as has_waiver
    from doc_row_cats
    group by player_id
  )
  select jsonb_build_object(
    'total', (select count(*)::int from p),
    'ready_count', (
      select count(*)::int
      from p
      left join per_player d on d.player_id = p.id
      where p.has_name
        and p.has_contact
        and coalesce(d.has_physical, false)
        and coalesce(d.has_waiver, false)
    )
  );
$$;

comment on function public.team_readiness_summary_minimal(uuid) is
  'Aggregated readiness: total players and count ready (name+contact + physical+waiver docs, non-expired).';

grant execute on function public.team_readiness_summary_minimal(uuid) to service_role;
grant execute on function public.team_readiness_summary_minimal(uuid) to authenticated;
