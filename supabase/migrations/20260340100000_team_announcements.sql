-- Team-scoped announcements (portal dashboard). Distinct from admin → HC `announcements` table.

create table if not exists public.team_announcements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  body text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_pinned boolean not null default false,
  audience text not null default 'all'
    check (audience in ('all', 'staff', 'players', 'parents')),
  send_notification boolean not null default false
);

create index if not exists idx_team_announcements_team_pinned_created
  on public.team_announcements (team_id, is_pinned desc, created_at desc);

comment on table public.team_announcements is 'Coach-posted team announcements visible to members per audience.';

-- RLS: reads for authenticated members matching audience; writes via service role (Next.js API) only.
alter table public.team_announcements enable row level security;

create or replace function public.team_announcement_visible_to_reader(p_team_id uuid, p_audience text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when not exists (select 1 from public.profiles pr where pr.id = auth.uid()) then false
    when not (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.team_id = p_team_id)
      or exists (select 1 from public.teams t where t.id = p_team_id and t.created_by = auth.uid())
      or exists (
        select 1 from public.teams t
        inner join public.program_members pm
          on pm.program_id = t.program_id and pm.user_id = auth.uid() and coalesce(pm.active, true)
        where t.id = p_team_id
      )
    ) then false
    when p_audience = 'all' then true
    when lower(coalesce((select role from public.profiles where id = auth.uid()), ''))
      in ('head_coach', 'assistant_coach', 'athletic_director', 'school_admin', 'admin') then true
    when p_audience = 'players'
      and lower(coalesce((select role from public.profiles where id = auth.uid()), '')) = 'player' then true
    when p_audience = 'parents'
      and lower(coalesce((select role from public.profiles where id = auth.uid()), '')) = 'parent' then true
    else false
  end;
$$;

drop policy if exists team_announcements_select_authenticated on public.team_announcements;
create policy team_announcements_select_authenticated on public.team_announcements
  for select to authenticated
  using (public.team_announcement_visible_to_reader(team_id, audience));

-- No insert/update/delete for authenticated — API uses service role.

grant select on public.team_announcements to authenticated;
