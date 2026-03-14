-- Comments on playbooks, formations, sub-formations, and plays. Team-scoped collaboration.
create table if not exists public.playbook_comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  parent_type text not null check (parent_type in ('playbook', 'formation', 'sub_formation', 'play')),
  parent_id uuid not null,
  author_id uuid not null,
  text text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_playbook_comments_team_id on public.playbook_comments(team_id);
create index if not exists idx_playbook_comments_parent on public.playbook_comments(parent_type, parent_id);
create index if not exists idx_playbook_comments_author_id on public.playbook_comments(author_id);

comment on table public.playbook_comments is 'Comments on playbook content (playbook, formation, sub-formation, play). Team-scoped.';

alter table public.playbook_comments enable row level security;
create policy playbook_comments_service_role on public.playbook_comments for all using (true) with check (true);
