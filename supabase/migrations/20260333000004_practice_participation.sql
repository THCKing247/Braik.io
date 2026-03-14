-- Practice participation for Coach B (limited, full, DNP, injury-related).
-- Links player to event (practice) with status and notes.

create table if not exists public.practice_participation (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  participation_status text not null,
  injury_related boolean not null default false,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_practice_participation_team_id on public.practice_participation(team_id);
create index if not exists idx_practice_participation_player_id on public.practice_participation(player_id);
create index if not exists idx_practice_participation_event_id on public.practice_participation(event_id);
create index if not exists idx_practice_participation_occurred_at on public.practice_participation(occurred_at desc);

alter table public.practice_participation enable row level security;

drop policy if exists practice_participation_service_role on public.practice_participation;
create policy practice_participation_service_role on public.practice_participation for all using (true) with check (true);

comment on table public.practice_participation is 'Per-practice player participation for Coach B availability and injury context.';
comment on column public.practice_participation.participation_status is 'e.g. full, limited, DNP, non-contact.';
