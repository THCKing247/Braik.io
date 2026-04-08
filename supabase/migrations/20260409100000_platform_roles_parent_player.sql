-- Add platform_roles for parent and player so admin can assign them and backfill users.

insert into public.platform_roles (key, name, description, role_type, is_active, is_deletable, is_key_editable) values
  ('parent', 'Parent', 'Parent / guardian access: view team-facing areas and message staff as policy allows.', 'system', true, false, false),
  ('player', 'Player', 'Player / athlete access: roster app, schedule, messaging within policy.', 'system', true, false, false)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  role_type = excluded.role_type,
  is_deletable = excluded.is_deletable,
  is_key_editable = excluded.is_key_editable;

delete from public.platform_role_permissions where role_id in (select id from public.platform_roles where key = 'parent');
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, p.key
from public.platform_roles r
join public.platform_permissions p on p.key in (
  'view_teams',
  'view_roster',
  'view_playbooks',
  'view_schedule',
  'view_messages',
  'send_messages',
  'view_reports'
)
where r.key = 'parent';

delete from public.platform_role_permissions where role_id in (select id from public.platform_roles where key = 'player');
insert into public.platform_role_permissions (role_id, permission_key)
select r.id, p.key
from public.platform_roles r
join public.platform_permissions p on p.key in (
  'view_teams',
  'view_roster',
  'view_playbooks',
  'view_schedule',
  'view_messages',
  'send_messages',
  'view_reports',
  'coach_view_access'
)
where r.key = 'player';

update public.users u
set platform_role_id = r.id
from public.platform_roles r
where u.platform_role_id is null
  and lower(trim(u.role)) = 'parent'
  and r.key = 'parent';

update public.users u
set platform_role_id = r.id
from public.platform_roles r
where u.platform_role_id is null
  and lower(trim(u.role)) in ('player', 'athlete')
  and r.key = 'player';

insert into public.user_platform_roles (user_id, role_id)
select u.id, u.platform_role_id
from public.users u
where u.platform_role_id is not null
on conflict (user_id, role_id) do nothing;
