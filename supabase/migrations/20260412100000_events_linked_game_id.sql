-- Calendar ↔ Schedule: mirror each `games` row as a `GAME` event with a stable link.

alter table public.events
  add column if not exists linked_game_id uuid references public.games(id) on delete cascade;

comment on column public.events.linked_game_id is
  'When set, this calendar row mirrors a scheduled game (Games tab). Removed when the game is deleted.';

create unique index if not exists idx_events_linked_game_id_unique
  on public.events(linked_game_id)
  where linked_game_id is not null;

create index if not exists idx_events_team_linked_game
  on public.events(team_id, linked_game_id)
  where linked_game_id is not null;

-- Backfill: one GAME event per existing game (skip games that already have a linked row).
insert into public.events (
  team_id,
  event_type,
  title,
  description,
  start,
  "end",
  location,
  visibility,
  created_by,
  linked_game_id,
  updated_at
)
select
  g.team_id,
  'GAME',
  'vs ' || coalesce(nullif(trim(g.opponent), ''), 'Opponent'),
  g.notes,
  g.game_date,
  g.game_date + interval '2 hours',
  g.location,
  'TEAM',
  coalesce(
    (select u.id from public.users u where u.id = t.created_by limit 1),
    (select tm.user_id from public.team_members tm where tm.team_id = g.team_id and coalesce(tm.active, true) limit 1),
    (select id from public.users order by created_at asc limit 1)
  ),
  g.id,
  now()
from public.games g
inner join public.teams t on t.id = g.team_id
where not exists (select 1 from public.events e where e.linked_game_id = g.id);
