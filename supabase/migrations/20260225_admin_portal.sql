-- Admin portal baseline schema + RLS

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text,
  plan_tier text not null default 'starter',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  head_coach_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'new',
  category text,
  priority text default 'normal',
  subject text not null,
  original_message text not null,
  assigned_admin_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_admin_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_by_admin_id uuid not null references public.users(id) on delete cascade,
  scope text not null default 'all_head_coaches',
  team_id uuid references public.teams(id) on delete set null,
  head_coach_only boolean not null default true,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(u.role) = 'admin'
      and lower(u.status) = 'active'
  );
$$;

alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
for select using (id = auth.uid());

drop policy if exists teams_admin_all on public.teams;
create policy teams_admin_all on public.teams
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists teams_member_select on public.teams;
create policy teams_member_select on public.teams
for select using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = teams.id and tm.user_id = auth.uid() and tm.active = true
  )
);

drop policy if exists team_members_admin_all on public.team_members;
create policy team_members_admin_all on public.team_members
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists team_members_self_select on public.team_members;
create policy team_members_self_select on public.team_members
for select using (user_id = auth.uid());

drop policy if exists support_tickets_admin_all on public.support_tickets;
create policy support_tickets_admin_all on public.support_tickets
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists support_tickets_team_member_insert on public.support_tickets;
create policy support_tickets_team_member_insert on public.support_tickets
for insert with check (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = support_tickets.team_id and tm.user_id = auth.uid() and tm.active = true
  )
);

drop policy if exists support_tickets_head_coach_select on public.support_tickets;
create policy support_tickets_head_coach_select on public.support_tickets
for select using (
  head_coach_user_id = auth.uid() or created_by_user_id = auth.uid()
);

drop policy if exists support_messages_admin_all on public.support_messages;
create policy support_messages_admin_all on public.support_messages
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists support_messages_head_coach_select on public.support_messages;
create policy support_messages_head_coach_select on public.support_messages
for select using (
  exists (
    select 1 from public.support_tickets st
    where st.id = support_messages.ticket_id and st.head_coach_user_id = auth.uid()
  )
);

drop policy if exists announcements_admin_all on public.announcements;
create policy announcements_admin_all on public.announcements
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists announcements_head_coach_select on public.announcements;
create policy announcements_head_coach_select on public.announcements
for select using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = announcements.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'head_coach'
      and tm.active = true
  )
  or (announcements.team_id is null and exists (
    select 1 from public.team_members tm2
    where tm2.user_id = auth.uid()
      and tm2.role = 'head_coach'
      and tm2.active = true
  ))
);

drop policy if exists audit_logs_admin_all on public.audit_logs;
create policy audit_logs_admin_all on public.audit_logs
for all using (public.is_admin()) with check (public.is_admin());
