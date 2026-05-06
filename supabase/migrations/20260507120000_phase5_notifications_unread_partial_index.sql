-- Phase 5: smaller partial index for unread notification queries (additive only).
--
-- Code paths:
-- - lib/utils/notifications.ts getUnreadNotificationCount: notifications where user_id, team_id (optional), read = false (count head)
-- - lib/notifications/notifications-api-query.ts: list with eq user_id, eq team_id, optional eq read false, order created_at desc
--
-- Existing: idx_notifications_user_team_read_created (user_id, team_id, read, created_at desc)
-- This partial index covers only unread rows — typically fewer pages to scan for unread-only workloads.
--
-- Revert: DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_user_team_unread_created;

create index if not exists idx_notifications_user_team_unread_created
  on public.notifications(user_id, team_id, created_at desc)
  where read = false;

comment on index idx_notifications_user_team_unread_created is
  'Partial index for unread notification lists and count(head); matches read=false filters in API.';
