-- Authoritative enforcement of purchased roster slot limits on active players.
-- Mirrors lib/billing/roster-entitlement.ts: program.roster_slot_limit (if set and > 0) else teams.roster_slot_limit.
-- Inactive players do not count; only status = 'active' rows are counted.
-- Uses row locks (teams / programs) so concurrent signups cannot exceed the cap.

create or replace function public.enforce_players_active_roster_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team record;
  v_prog record;
  v_team_limit integer;
  v_effective_limit integer;
  v_scope text;
  v_program_id uuid;
  v_cnt integer;
  v_should_check boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status is not distinct from 'active' then
      v_should_check := true;
    end if;
  elsif tg_op = 'UPDATE' then
    -- Same-team activation: was not active, now active
    if new.team_id is not distinct from old.team_id
       and new.status = 'active'
       and old.status is distinct from 'active' then
      v_should_check := true;
    end if;
    -- Team moves: skip in v1 (handled by app flows / future migration)
    if new.team_id is distinct from old.team_id then
      return new;
    end if;
  end if;

  if not v_should_check then
    return new;
  end if;

  select t.id, t.program_id, t.roster_slot_limit
  into v_team
  from public.teams t
  where t.id = new.team_id
  for update of t;

  if not found then
    raise exception 'BRAIK_TEAM_NOT_FOUND_FOR_ROSTER_CHECK';
  end if;

  v_program_id := v_team.program_id;
  v_team_limit := v_team.roster_slot_limit;
  v_effective_limit := null;
  v_scope := null;

  if v_program_id is not null then
    select p.id, p.roster_slot_limit
    into v_prog
    from public.programs p
    where p.id = v_program_id
    for update of p;

    if found and v_prog.roster_slot_limit is not null and v_prog.roster_slot_limit > 0 then
      v_effective_limit := v_prog.roster_slot_limit;
      v_scope := 'program';
    end if;
  end if;

  if v_effective_limit is null and v_team_limit is not null and v_team_limit > 0 then
    v_effective_limit := v_team_limit;
    v_scope := 'team';
  end if;

  if v_effective_limit is null then
    return new;
  end if;

  if v_scope = 'program' then
    select count(*)::integer
    into v_cnt
    from public.players pl
    inner join public.teams tm on tm.id = pl.team_id
    where tm.program_id = v_program_id
      and pl.status = 'active'
      and pl.id is distinct from new.id;
  else
    select count(*)::integer
    into v_cnt
    from public.players pl
    where pl.team_id = new.team_id
      and pl.status = 'active'
      and pl.id is distinct from new.id;
  end if;

  if v_cnt + 1 > v_effective_limit then
    raise exception 'BRAIK_ROSTER_FULL'
      using errcode = 'P0001',
            detail = json_build_object(
              'code', 'ROSTER_FULL',
              'scope', v_scope,
              'limit', v_effective_limit,
              'current', v_cnt
            )::text;
  end if;

  return new;
end;
$$;

comment on function public.enforce_players_active_roster_limit() is
  'Before insert/update of active players: enforce program or team roster_slot_limit vs active player counts.';

drop trigger if exists players_enforce_active_roster_limit on public.players;

create trigger players_enforce_active_roster_limit
  before insert or update on public.players
  for each row
  execute procedure public.enforce_players_active_roster_limit();

-- Optional manual audit: teams where active player count exceeds effective limit (should be empty after trigger is live).
-- select t.id, t.name, t.roster_slot_limit, p.roster_slot_limit as program_limit,
--   (select count(*)::int from public.players pl where pl.team_id = t.id and pl.status = 'active') as active_cnt
-- from public.teams t
-- left join public.programs p on p.id = t.program_id;
