-- Complements idx_events_team_start (20260361300002): overlap filter uses
-- start <= range_end AND end >= range_start — (team_id, end) helps the end predicate.

create index if not exists idx_events_team_end
  on public.events(team_id, "end" asc);
