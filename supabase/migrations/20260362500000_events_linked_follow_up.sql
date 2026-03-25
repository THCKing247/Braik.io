-- Link calendar events to player follow-ups (coach scheduling + resolution sync).

alter table public.events
  add column if not exists linked_follow_up_id uuid references public.player_follow_ups(id) on delete set null;

create index if not exists idx_events_linked_follow_up_id
  on public.events(linked_follow_up_id)
  where linked_follow_up_id is not null;

comment on column public.events.linked_follow_up_id is 'Optional link to a player follow-up row; used to update the calendar when the follow-up is resolved.';
