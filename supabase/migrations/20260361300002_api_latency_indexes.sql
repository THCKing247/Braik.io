-- Composite/partial indexes for common team-scoped portal queries.

create index if not exists idx_events_team_start
  on public.events(team_id, start asc);

create index if not exists idx_messages_thread_created_not_deleted
  on public.messages(thread_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_messages_thread_sender_created_not_deleted
  on public.messages(thread_id, sender_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_message_threads_team_updated
  on public.message_threads(team_id, updated_at desc);

create index if not exists idx_message_thread_participants_user_thread
  on public.message_thread_participants(user_id, thread_id);

create index if not exists idx_documents_team_created
  on public.documents(team_id, created_at desc);

create index if not exists idx_document_shares_doc_user
  on public.document_shares(document_id, shared_with_user_id);

create index if not exists idx_players_team_status_last_first
  on public.players(team_id, status, last_name, first_name);

create index if not exists idx_player_injuries_team_status_date
  on public.player_injuries(team_id, status, injury_date desc);

create index if not exists idx_notifications_user_team_read_created
  on public.notifications(user_id, team_id, read, created_at desc);

create index if not exists idx_player_documents_team_player_exp_not_deleted
  on public.player_documents(team_id, player_id, expires_at)
  where deleted_at is null;

create index if not exists idx_team_members_team_active_user
  on public.team_members(team_id, active, user_id);

create index if not exists idx_program_members_program_user_active
  on public.program_members(program_id, user_id, active);
