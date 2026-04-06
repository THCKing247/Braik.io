-- Platform-level roles & granular permissions (admin console / future enforcement).
-- Service-role APIs bypass RLS; JWT users have no direct access.
-- gen_random_uuid() requires pgcrypto (also ensured by earlier Braik baseline migrations).

create extension if not exists pgcrypto;

create table if not exists public.platform_permissions (
  key text primary key,
  section text not null,
  label text not null,
  description text not null default ''
);

create table if not exists public.platform_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  role_type text not null default 'custom' check (role_type in ('system', 'custom')),
  is_active boolean not null default true,
  is_deletable boolean not null default true,
  is_key_editable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_roles_key on public.platform_roles (key);
create index if not exists idx_platform_roles_role_type on public.platform_roles (role_type);

create table if not exists public.platform_role_permissions (
  role_id uuid not null references public.platform_roles (id) on delete cascade,
  permission_key text not null references public.platform_permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create index if not exists idx_platform_role_permissions_permission on public.platform_role_permissions (permission_key);

alter table public.users add column if not exists platform_role_id uuid references public.platform_roles (id) on delete set null;
create index if not exists idx_users_platform_role_id on public.users (platform_role_id) where platform_role_id is not null;

-- Optional many-to-many: mirrors users.platform_role_id; app syncs both. Created here so fresh DBs get full schema in one migration.
create table if not exists public.user_platform_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.platform_roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create index if not exists idx_user_platform_roles_user on public.user_platform_roles (user_id);
create index if not exists idx_user_platform_roles_role on public.user_platform_roles (role_id);

alter table public.platform_roles enable row level security;
alter table public.platform_permissions enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.user_platform_roles enable row level security;

-- Catalog: all platform permission keys (grouped in app UI by section)
insert into public.platform_permissions (key, section, label, description) values
  ('view_admin_portal', 'Admin Portal', 'View admin portal', 'Access the Braik admin portal UI.'),
  ('manage_platform_settings', 'Admin Portal', 'Manage platform settings', 'Change global platform configuration.'),
  ('manage_roles_permissions', 'Admin Portal', 'Manage roles & permissions', 'Create and edit platform roles and permission sets.'),
  ('manage_users', 'Admin Portal', 'Manage users', 'Create, edit, and suspend platform users.'),
  ('manage_organizations', 'Admin Portal', 'Manage organizations', 'Manage organizations and high-level structure.'),
  ('view_teams', 'Teams', 'View teams', 'See team records and metadata.'),
  ('create_teams', 'Teams', 'Create teams', 'Create new teams.'),
  ('edit_teams', 'Teams', 'Edit teams', 'Update team settings and metadata.'),
  ('delete_teams', 'Teams', 'Delete teams', 'Archive or delete teams.'),
  ('assign_team_staff', 'Teams', 'Assign team staff', 'Assign coaches and staff to teams.'),
  ('view_roster', 'Rosters', 'View roster', 'View roster and player profiles.'),
  ('create_players', 'Rosters', 'Create players', 'Add players to the roster.'),
  ('edit_players', 'Rosters', 'Edit players', 'Edit player profiles and assignments.'),
  ('delete_players', 'Rosters', 'Delete players', 'Remove players from the roster.'),
  ('import_roster', 'Rosters', 'Import roster', 'Bulk import roster data.'),
  ('view_playbooks', 'Playbooks', 'View playbooks', 'Open and review playbooks.'),
  ('create_playbooks', 'Playbooks', 'Create playbooks', 'Create new playbook content.'),
  ('edit_playbooks', 'Playbooks', 'Edit playbooks', 'Edit installs and playbook content.'),
  ('delete_playbooks', 'Playbooks', 'Delete playbooks', 'Remove playbook content.'),
  ('view_schedule', 'Schedule / Calendar', 'View schedule', 'View calendar and events.'),
  ('create_schedule_events', 'Schedule / Calendar', 'Create schedule events', 'Create practices, games, and events.'),
  ('edit_schedule_events', 'Schedule / Calendar', 'Edit schedule events', 'Update events on the calendar.'),
  ('delete_schedule_events', 'Schedule / Calendar', 'Delete schedule events', 'Remove events from the calendar.'),
  ('view_messages', 'Messaging', 'View messages', 'Read team and staff messaging threads.'),
  ('send_messages', 'Messaging', 'Send messages', 'Send messages where policy allows.'),
  ('manage_message_templates', 'Messaging', 'Manage message templates', 'Create and edit reusable message templates.'),
  ('view_reports', 'Reports / Documents', 'View reports', 'Access reports and analytics views.'),
  ('upload_documents', 'Reports / Documents', 'Upload documents', 'Upload files and resources.'),
  ('manage_documents', 'Reports / Documents', 'Manage documents', 'Organize, publish, or remove shared documents.'),
  ('view_billing', 'Billing / Subscription', 'View billing', 'View invoices, plans, and subscription status.'),
  ('manage_billing', 'Billing / Subscription', 'Manage billing', 'Change plans, payment methods, and billing settings.'),
  ('view_ad_dashboard', 'Athletic Director / Coach Views', 'View AD dashboard', 'Access athletic department dashboards and summaries.'),
  ('coach_view_access', 'Athletic Director / Coach Views', 'Coach view access', 'Use coach-facing tools and views across assigned scope.'),
  ('manage_team_settings', 'Athletic Director / Coach Views', 'Manage team settings', 'Change team-level configuration where allowed.')
on conflict (key) do update set
  section = excluded.section,
  label = excluded.label,
  description = excluded.description;

-- Default system roles
insert into public.platform_roles (key, name, description, role_type, is_active, is_deletable, is_key_editable) values
  ('platform_admin', 'Platform Admin', 'Full platform access including admin portal management.', 'system', true, false, false),
  ('athletic_director', 'Athletic Director', 'Department-level access across teams, rosters, and schedules.', 'system', true, false, false),
  ('head_coach', 'Head Coach', 'Team leadership: rosters, playbooks, schedule, and messaging.', 'system', true, false, false),
  ('assistant_coach', 'Assistant Coach', 'Coaching staff access with limited destructive actions.', 'system', true, false, false),
  ('team_staff', 'Team Staff', 'Operational access: view and communicate without full coaching controls.', 'system', true, false, false),
  ('read_only', 'Read Only', 'View-only access to permitted areas.', 'system', true, false, false)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  role_type = excluded.role_type,
  is_deletable = excluded.is_deletable,
  is_key_editable = excluded.is_key_editable;

-- Helper: replace role permissions wholesale (idempotent for migrations)
delete from public.platform_role_permissions where role_id in (select id from public.platform_roles where key = 'platform_admin');
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, p.key
from public.platform_roles r
cross join public.platform_permissions p
where r.key = 'platform_admin';

delete from public.platform_role_permissions where role_id in (select id from public.platform_roles where key = 'athletic_director');
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, p.key
from public.platform_roles r
join public.platform_permissions p on p.key in (
  'view_admin_portal','manage_organizations','manage_users','view_teams','create_teams','edit_teams','delete_teams','assign_team_staff',
  'view_roster','create_players','edit_players','delete_players','import_roster',
  'view_playbooks','create_playbooks','edit_playbooks','delete_playbooks',
  'view_schedule','create_schedule_events','edit_schedule_events','delete_schedule_events',
  'view_messages','send_messages','manage_message_templates',
  'view_reports','upload_documents','manage_documents',
  'view_billing','view_ad_dashboard','coach_view_access','manage_team_settings'
)
where r.key = 'athletic_director';

delete from public.platform_role_permissions where role_id in (select id from public.platform_roles where key = 'head_coach');
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, p.key
from public.platform_roles r
join public.platform_permissions p on p.key in (
  'view_teams','create_teams','edit_teams','delete_teams','assign_team_staff',
  'view_roster','create_players','edit_players','delete_players','import_roster',
  'view_playbooks','create_playbooks','edit_playbooks','delete_playbooks',
  'view_schedule','create_schedule_events','edit_schedule_events','delete_schedule_events',
  'view_messages','send_messages','manage_message_templates',
  'view_reports','upload_documents','manage_documents',
  'view_billing','coach_view_access','manage_team_settings'
)
where r.key = 'head_coach';

delete from public.platform_role_permissions where role_id in (select id from public.platform_roles where key = 'assistant_coach');
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, p.key
from public.platform_roles r
join public.platform_permissions p on p.key in (
  'view_teams','edit_teams','assign_team_staff',
  'view_roster','create_players','edit_players','import_roster',
  'view_playbooks','create_playbooks','edit_playbooks',
  'view_schedule','create_schedule_events','edit_schedule_events',
  'view_messages','send_messages',
  'view_reports','upload_documents',
  'coach_view_access','manage_team_settings'
)
where r.key = 'assistant_coach';

delete from public.platform_role_permissions where role_id in (select id from public.platform_roles where key = 'team_staff');
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, p.key
from public.platform_roles r
join public.platform_permissions p on p.key in (
  'view_teams','view_roster','view_playbooks','view_schedule','view_messages','send_messages','view_reports','coach_view_access'
)
where r.key = 'team_staff';

delete from public.platform_role_permissions where role_id in (select id from public.platform_roles where key = 'read_only');
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, p.key
from public.platform_roles r
join public.platform_permissions p on p.key in (
  'view_teams','view_roster','view_playbooks','view_schedule','view_messages','view_reports','view_billing','view_ad_dashboard'
)
where r.key = 'read_only';

-- Map existing users.role values to default platform roles when unset (non-destructive).
update public.users u
set platform_role_id = r.id
from public.platform_roles r
where u.platform_role_id is null
  and lower(trim(u.role)) = 'admin'
  and r.key = 'platform_admin';

update public.users u
set platform_role_id = r.id
from public.platform_roles r
where u.platform_role_id is null
  and lower(trim(u.role)) = 'athletic_director'
  and r.key = 'athletic_director';

update public.users u
set platform_role_id = r.id
from public.platform_roles r
where u.platform_role_id is null
  and lower(trim(u.role)) = 'head_coach'
  and r.key = 'head_coach';

update public.users u
set platform_role_id = r.id
from public.platform_roles r
where u.platform_role_id is null
  and lower(trim(u.role)) = 'assistant_coach'
  and r.key = 'assistant_coach';

insert into public.user_platform_roles (user_id, role_id)
select u.id, u.platform_role_id
from public.users u
where u.platform_role_id is not null
on conflict (user_id, role_id) do nothing;

comment on table public.platform_roles is 'Platform-wide roles for admin portal access and future permission enforcement.';
comment on table public.platform_permissions is 'Stable permission keys; labels shown in admin Roles & Permissions UI.';
comment on table public.platform_role_permissions is 'Join: which permissions each platform role grants.';
comment on table public.user_platform_roles is 'Optional many-to-many; when empty for a user, fall back to users.platform_role_id. Service-role APIs sync both.';
comment on column public.users.platform_role_id is 'Optional link to platform_roles for granular permissions; legacy users.role still used by auth until fully migrated.';
