-- Backfill: create one program per existing team and link team to program (backward compatibility)

do $$
declare
  t record;
  new_program_id uuid;
  creator_id uuid;
  plan_tier_val text;
begin
  for t in
    select id, name, created_by, sport,
           coalesce(nullif(trim(plan_type), ''), 'starter') as plan_val
    from public.teams
    where program_id is null
  loop
    creator_id := t.created_by;
    if creator_id is null then
      select p.id into creator_id from public.profiles p where p.team_id = t.id and p.role ilike '%head_coach%' limit 1;
    end if;

    plan_tier_val := t.plan_val;
    if lower(plan_tier_val) = 'athletic_department_license' or lower(plan_tier_val) = 'athletic_director' then
      plan_tier_val := 'athletic_director';
    else
      plan_tier_val := 'head_coach';
    end if;

    insert into public.programs (organization_id, created_by_user_id, program_name, sport, plan_type)
    values (null, creator_id, t.name, coalesce(nullif(trim(t.sport), ''), 'football'), plan_tier_val)
    returning id into new_program_id;

    update public.teams
    set program_id = new_program_id,
        team_level = 'varsity',
        plan_type = plan_tier_val
    where id = t.id;

    if creator_id is not null then
      insert into public.program_members (program_id, user_id, role)
      values (new_program_id, creator_id, case when plan_tier_val = 'athletic_director' then 'athletic_director' else 'head_coach' end)
      on conflict (program_id, user_id) do nothing;
    end if;
  end loop;
end $$;
