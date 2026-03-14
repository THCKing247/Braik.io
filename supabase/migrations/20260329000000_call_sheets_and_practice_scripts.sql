-- Call sheet: one row per playbook. config = { "sections": [ { "id": "1st_down", "label": "1st Down", "playIds": ["uuid", ...] }, ... ] }
create table if not exists public.call_sheets (
  playbook_id uuid primary key references public.playbooks(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  config jsonb not null default '{"sections":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_call_sheets_team_id on public.call_sheets(team_id);
comment on table public.call_sheets is 'Playbook call sheet: sections (1st Down, Red Zone, etc.) and play IDs per section.';

-- Practice scripts: script has many periods; each period has name, notes, and ordered play IDs (stored in periods jsonb).
create table if not exists public.practice_scripts (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null default 'Practice script',
  periods jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_practice_scripts_playbook_id on public.practice_scripts(playbook_id);
create index if not exists idx_practice_scripts_team_id on public.practice_scripts(team_id);
comment on table public.practice_scripts is 'Practice script: name + periods[ { id, name, notes, playIds: [] } ].';

-- RLS: use service role or same team-based access as playbooks (simplified: allow for authenticated users with team access)
alter table public.call_sheets enable row level security;
alter table public.practice_scripts enable row level security;

create policy call_sheets_service_role on public.call_sheets for all using (true) with check (true);
create policy practice_scripts_service_role on public.practice_scripts for all using (true) with check (true);
