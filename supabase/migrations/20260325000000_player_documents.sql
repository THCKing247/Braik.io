-- Player-scoped documents: forms, waivers, eligibility, coach-uploaded files
-- Coaches manage; players can view (visibility can be extended later).

create table if not exists public.player_documents (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  file_name text not null,
  file_url text,
  file_size bigint,
  mime_type text,
  category text not null default 'other',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_documents_player_id on public.player_documents(player_id);
create index if not exists idx_player_documents_team_id on public.player_documents(team_id);
alter table public.player_documents enable row level security;

drop policy if exists player_documents_service_role on public.player_documents;
create policy player_documents_service_role on public.player_documents for all using (true) with check (true);

comment on table public.player_documents is 'Documents attached to a player (forms, waivers, eligibility). Coach-managed; players can view their own.';
