-- Phase 3: foundational tables for weight room programming and study guides (team-scoped).

create table if not exists public.weight_room_program_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null default 'Program template',
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id)
);

create index if not exists idx_weight_room_templates_team on public.weight_room_program_templates(team_id);

alter table public.weight_room_program_templates enable row level security;

drop policy if exists weight_room_templates_service_role on public.weight_room_program_templates;
create policy weight_room_templates_service_role on public.weight_room_program_templates
  for all using (true) with check (true);

drop policy if exists weight_room_templates_team_read on public.weight_room_program_templates;
create policy weight_room_templates_team_read on public.weight_room_program_templates
  for select using (public.is_team_member(team_id));

drop policy if exists weight_room_templates_coach_write on public.weight_room_program_templates;
create policy weight_room_templates_coach_write on public.weight_room_program_templates
  for all using (public.can_edit_roster(team_id)) with check (public.can_edit_roster(team_id));

create table if not exists public.study_guides (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  body text,
  sort_order integer not null default 0,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_guides_team on public.study_guides(team_id);

alter table public.study_guides enable row level security;

drop policy if exists study_guides_service_role on public.study_guides;
create policy study_guides_service_role on public.study_guides
  for all using (true) with check (true);

drop policy if exists study_guides_team_read on public.study_guides;
create policy study_guides_team_read on public.study_guides
  for select using (public.is_team_member(team_id));

drop policy if exists study_guides_coach_write on public.study_guides;
create policy study_guides_coach_write on public.study_guides
  for all using (public.can_edit_roster(team_id)) with check (public.can_edit_roster(team_id));

comment on table public.weight_room_program_templates is 'Phase 3 scaffold: team-level weight room block templates; extend with lifts/sessions in a later phase.';
comment on table public.study_guides is 'Phase 3 scaffold: team study guide entries; players read, coaches manage.';
