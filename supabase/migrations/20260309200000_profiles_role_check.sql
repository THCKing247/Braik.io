-- Allow all app profile roles including athletic_director.
-- Drop any existing check constraint on profiles that involves role (name may vary).
do $$
declare
  r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  )
  loop
    execute format('alter table public.profiles drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.profiles add constraint profiles_role_check check (
  role in (
    'player',
    'head_coach',
    'assistant_coach',
    'athletic_director',
    'parent',
    'admin',
    'user'
  )
);
