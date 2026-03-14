-- Install scripts: ordered list of plays for presenter (e.g. install order for teaching).
-- Coaches build scripts from playbook plays, then open presenter with script order.

create table if not exists public.install_scripts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  name text not null default 'Install script',
  created_at timestamptz not null default now()
);

create index if not exists idx_install_scripts_playbook_id on public.install_scripts(playbook_id);
create index if not exists idx_install_scripts_team_id on public.install_scripts(team_id);

create table if not exists public.install_script_items (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.install_scripts(id) on delete cascade,
  play_id uuid not null references public.plays(id) on delete cascade,
  order_index integer not null default 0
);

create index if not exists idx_install_script_items_script_id on public.install_script_items(script_id);
create unique index if not exists idx_install_script_items_script_play on public.install_script_items(script_id, play_id);

alter table public.install_scripts enable row level security;
alter table public.install_script_items enable row level security;

create policy install_scripts_service_role on public.install_scripts for all using (true) with check (true);
create policy install_script_items_service_role on public.install_script_items for all using (true) with check (true);

comment on table public.install_scripts is 'Ordered install scripts for a playbook; used in presenter for script-based navigation.';
comment on table public.install_script_items is 'Ordered play references within an install script (order_index).';
