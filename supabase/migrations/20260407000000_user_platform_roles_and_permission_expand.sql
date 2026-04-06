-- Permission catalog expansion + grants (runs after 20260406000000_platform_roles_permissions.sql).
--
-- For databases that already applied an older 060 without user_platform_roles: create + backfill idempotently.
-- For fresh databases: 060 already created these objects; IF NOT EXISTS / ON CONFLICT make this a no-op for DDL and safe for data.

create table if not exists public.user_platform_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.platform_roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create index if not exists idx_user_platform_roles_user on public.user_platform_roles (user_id);
create index if not exists idx_user_platform_roles_role on public.user_platform_roles (role_id);

insert into public.user_platform_roles (user_id, role_id)
select u.id, u.platform_role_id
from public.users u
where u.platform_role_id is not null
on conflict (user_id, role_id) do nothing;

alter table public.user_platform_roles enable row level security;

comment on table public.user_platform_roles is
  'Optional many-to-many; when empty for a user, fall back to users.platform_role_id. Service-role APIs sync both.';

-- ---------------------------------------------------------------------------
-- Additional permission keys (additive; safe to re-run)
-- ---------------------------------------------------------------------------
insert into public.platform_permissions (key, section, label, description) values
  ('impersonate_users', 'Admin Portal', 'Impersonate users', 'Sign in as another user for support (sudo).'),
  ('view_audit_logs', 'Admin Portal', 'View audit logs', 'Read platform audit and security logs.'),
  ('export_roster', 'Rosters', 'Export roster', 'Export roster data to file or external systems.'),
  ('export_reports', 'Reports / Documents', 'Export reports', 'Export reports and analytics.'),
  ('message_players', 'Messaging', 'Message players', 'Send messages to players where policy allows.'),
  ('message_parents', 'Messaging', 'Message parents', 'Send messages to parents where policy allows.'),
  ('message_staff', 'Messaging', 'Message staff', 'Send messages to coaching and staff.'),
  ('manage_program_settings', 'Athletic Director / Coach Views', 'Manage program settings', 'Change program-level configuration.')
on conflict (key) do update set
  section = excluded.section,
  label = excluded.label,
  description = excluded.description;

-- New keys for platform_admin (full catalog includes any new rows above)
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, p.key
from public.platform_roles r
cross join public.platform_permissions p
where r.key = 'platform_admin'
on conflict do nothing;

-- Additive grants for other seeded roles
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, k.permission_key
from public.platform_roles r
inner join (
  values
    ('athletic_director'::text, 'export_roster'::text),
    ('athletic_director', 'export_reports'),
    ('athletic_director', 'message_players'),
    ('athletic_director', 'message_parents'),
    ('athletic_director', 'message_staff'),
    ('athletic_director', 'manage_program_settings'),
    ('head_coach', 'export_roster'),
    ('head_coach', 'message_players'),
    ('head_coach', 'message_parents'),
    ('head_coach', 'message_staff'),
    ('head_coach', 'manage_program_settings'),
    ('assistant_coach', 'export_roster'),
    ('assistant_coach', 'message_players'),
    ('assistant_coach', 'message_staff'),
    ('team_staff', 'message_players'),
    ('team_staff', 'message_staff'),
    ('read_only', 'export_reports')
) as k (role_key, permission_key) on r.key = k.role_key
on conflict do nothing;
