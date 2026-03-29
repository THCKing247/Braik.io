-- AD teams table: pending coach invites per team (team_id IN (...) AND accepted_at IS NULL AND expires_at > now()).
create index if not exists idx_invites_team_pending_expires
  on public.invites (team_id, expires_at desc)
  where accepted_at is null;
