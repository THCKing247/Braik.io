-- Allow all app profile roles including athletic_director.
-- Drop existing check so we can replace it with the full set.
alter table public.profiles drop constraint if exists profiles_role_check;

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
