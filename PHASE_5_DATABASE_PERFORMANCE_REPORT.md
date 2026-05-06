# Phase 5 — Database performance (Supabase / Postgres)

## Scope

Evidence-backed inventory of hot-path queries, existing indexes in-repo, RLS/realtime notes, and **one additive** migration aimed at unread-notification access patterns. No index drops, no RLS weakening.

**Live diagnostics:** Not executed from this workspace (no production DB credentials in-agent). Use `scripts/phase5-readonly-diagnostics.sql` in the Supabase SQL editor or psql, then compare `pg_stat_user_indexes` before/after any rollout.

---

## 1. Baseline advisor findings (Phase 0 reference)

Supabase performance advisor reported **many unused indexes**, including names similar to:

| Advisor-style name (exact naming varies by environment) | Notes |
|--------------------------------------------------------|--------|
| `idx_messages_thread_id_created_at` | **Not present** in this repo under that name; see §5 for actual index names. |
| `idx_message_threads_updated_at` | Original migration has `idx_message_threads_updated_at`; API prefers **`(team_id, updated_at desc)`** (`idx_message_threads_team_updated`). |
| `idx_message_threads_team_updated` | **Defined** in `20260361300002_api_latency_indexes.sql` — “unused” may mean low `idx_scan` in advisor snapshot **or** stats reset — verify `idx_scan` before dropping anything. |
| `idx_message_attachments_thread_id` | **Defined** in `20260310000000_messaging_system.sql`; thread detail loads attachments by `message_id` — thread_id index may be rare depending on code paths. |
| `idx_notifications_team_read_created` | Repo uses **`idx_notifications_user_team_read_created`** `(user_id, team_id, read, created_at desc)`. |
| `idx_notifications_user_unread_fast` | **Not in repo** — may be production-only or advisor shorthand. |

**Policy:** Do **not** drop indexes automatically. Confirm with `pg_stat_user_indexes`, table cardinality, and `EXPLAIN (ANALYZE, BUFFERS)` on production-like data.

---

## 2. Hot-path queries reviewed (code inventory)

### Messaging — inbox list

| Item | Detail |
|------|--------|
| **Route** | `GET /api/messages/threads` — `app/api/messages/threads/route.ts` |
| **Purpose** | Threads for `teamId` where user is a participant; previews, unread counts, pagination. |
| **Tables** | `message_thread_participants`, `message_threads`, `messages`, `users`, `players`, `team_members`, `profiles` |
| **Key filters** | Participants: `user_id = current`; threads: `team_id`, `id IN threadIds`, `order updated_at desc`, `range offset/limit`; **totals + unread:** `public.message_thread_inbox_stats(p_thread_ids, p_user_id)` — DB-side `COUNT`/`FILTER` over `messages` joined with `last_read_at` from `message_thread_participants` (no row transfer for stats). **Preview:** still `messages` `order created_at desc limit 400` for latest-by-thread (bounded). |
| **Cardinality** | Threads/page capped at 100; stats path no longer scales with total message rows transferred to Node (aggregate only). |
| **Indexes** | `idx_message_thread_participants_user_thread`, `idx_message_threads_team_id`, `idx_message_threads_team_updated`, `idx_messages_thread_not_deleted` / `idx_messages_thread_created_not_deleted` (see §5 duplicates). |

### Messaging — thread detail

| Item | Detail |
|------|--------|
| **Route** | `GET /api/messages/threads/[threadId]` — `app/api/messages/threads/[threadId]/route.ts` |
| **Purpose** | Single thread + all messages ascending + participants + attachments by message ids. |
| **Key filters** | `message_threads.id`; `message_thread_participants.thread_id`; `messages.thread_id` + `order created_at asc`; `message_attachments.message_id IN (...)`. |
| **Indexes** | PK/`idx_messages_thread_*` for messages by thread; `idx_message_attachments_message_id`. |

### Messaging — mark read

| Item | Detail |
|------|--------|
| **Route** | `POST /api/messages/threads/[threadId]/read` — `app/api/messages/threads/[threadId]/read/route.ts` |
| **Purpose** | Update `last_read_at` for `(thread_id, user_id)`. |
| **Indexes** | PK on `(thread_id, user_id)` on `message_thread_participants`; supports point update. |

### Messaging — send

| Item | Detail |
|------|--------|
| **Route** | `POST /api/messages/send` — `app/api/messages/send/route.ts` |
| **Purpose** | Insert `messages`; optional attachment updates; notifications via `createNotifications`. |
| **Key writes** | `messages` insert `thread_id`, `sender_id`; trigger updates `message_threads.updated_at`. |

### Notifications — API + unread count

| Item | Detail |
|------|--------|
| **Routes / libs** | `GET /api/notifications` → `lib/notifications/notifications-api-query.ts`; `lib/utils/notifications.ts` — `getUnreadNotificationCount`, `markAllNotificationsAsRead`. |
| **Reads** | `notifications`: `eq user_id`, `eq team_id`, optional `eq read`, `order created_at desc`, `range`; count: `select id head count exact` with `user_id`, `read=false`, optional `team_id`. |
| **Indexes (existing)** | `idx_notifications_user_read`; `idx_notifications_user_team_read_created` (composite). |
| **Phase 5 migration** | Additive **partial** index on unread rows only — §6. |

### Dashboard bootstrap

| Item | Detail |
|------|--------|
| **Routes** | `GET /api/dashboard/bootstrap`, deferred routes — `lib/dashboard/build-full-dashboard-bootstrap.ts`, `build-dashboard-bootstrap-data.ts`, `build-dashboard-deferred-bootstrap.ts`. |
| **Data** | Teams, games, events, readiness (cached), **`loadNotificationsApiPayload`** (notifications preview + unread), announcements, roster, depth chart, etc. |
| **Note** | Heavy lifting uses **app-layer cache** (`lightweightCached`, bootstrap merge); DB indexes support underlying selects on `teams`, `games`, `events`, `notifications`, `players`, … |

### Tables referenced in task list but absent / indirect

| Table | Status |
|-------|--------|
| `message_read_receipts` | **Not found** in codebase — unread uses `message_thread_participants.last_read_at` + message timestamps. |

---

## 3. EXPLAIN plans reviewed

No production `EXPLAIN` output was captured in this environment. Use these **templates** (parameterize UUIDs) after running read-only stats:

```sql
-- Thread list message stats (matches inbox filter shape)
explain (analyze, buffers)
select thread_id, sender_id, created_at
from public.messages
where thread_id = '<thread_uuid>'
  and deleted_at is null;

-- Notifications preview + unread alignment
explain (analyze, buffers)
select id, type, title, created_at
from public.notifications
where user_id = '<user_uuid>'
  and team_id = '<team_uuid>'
  and read = false
order by created_at desc
limit 15;

explain (analyze, buffers)
select id
from public.notifications
where user_id = '<user_uuid>'
  and team_id = '<team_uuid>'
  and read = false;
-- expect Index Scan / Partial index after Phase 5 migration
```

---

## 4. Indexes added (this phase)

| Migration | Index | Rationale |
|-----------|--------|-----------|
| `supabase/migrations/20260507120000_phase5_notifications_unread_partial_index.sql` | `idx_notifications_user_team_unread_created` on `(user_id, team_id, created_at desc) WHERE read = false` | Matches `getUnreadNotificationCount` and unread-only branches in `loadNotificationsApiPayload`; smaller than full composite when most rows are read. |

**Revert (production):** `DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_user_team_unread_created;`

### 4b. Inbox aggregate RPC + app route (follow-up shipped)

| Artifact | Purpose |
|----------|---------|
| `supabase/migrations/20260508120000_message_thread_inbox_stats_rpc.sql` | `message_thread_inbox_stats(uuid[], uuid)` returns per-thread `message_count` and `unread_count` using the same rules as the prior JS loop (`deleted_at` null, exclude own messages from unread, compare `created_at` to `last_read_at`). Uses existing btree indexes on `messages(thread_id, …)` / participants — **no new indexes required** for correctness. |
| `app/api/messages/threads/route.ts` | Replaced `.select(thread_id, sender_id, created_at)` over all inbox messages with **one `rpc('message_thread_inbox_stats')`** call. Response JSON unchanged. |
| `lib/messaging/inbox-unread-logic.ts` + `tests/message-inbox-unread-logic.test.ts` | Documents unread math for regressions; mirrors legacy loop. |

**Expected backend impact:** Far less **network + JSON decode** volume from PostgREST for busy threads; Postgres performs indexed aggregation instead of shipping every message row to the API process.

**Revert RPC (only if needed):** restore prior select loop in `route.ts` and `DROP FUNCTION public.message_thread_inbox_stats(uuid[], uuid);` after switching code back.

---

## 5. Indexes intentionally not changed

| Topic | Reason |
|-------|--------|
| **Duplicate message covering indexes** | `idx_messages_thread_not_deleted` (`20260347000000_phase1_roster_injuries_messages_billing.sql`) vs `idx_messages_thread_created_not_deleted` (`20260361300002_api_latency_indexes.sql`) — both `(thread_id, created_at desc) WHERE deleted_at is null`. **Possible duplicate** — confirm `pg_indexes` on target DB; drop one only after measurement **CONCURRENTLY** in low-traffic window. |
| **Advisor “unused” messaging indexes** | May reflect resets, low traffic staging, or queries served by another index — verify `idx_scan`. |
| **`idx_message_attachments_thread_id`** | Keep until attachment-by-thread API patterns confirmed unused. |

---

## 6. RLS policies reviewed

| Area | Finding |
|------|---------|
| **Messaging tables** (`20260310000000_messaging_system.sql`) | Policies named `*_service_role` with `using (true)` — API uses **server Supabase client**; **authorization is enforced in Next.js** (`requireTeamAccess`, participant checks). Phase 5 does **not** change policies. |
| **Notifications** (`20260303000000_profiles_and_auth_sync.sql`) | Table created with RLS enabled; actual policy definitions extended in later migrations — **no changes** in Phase 5. |

---

## 7. Realtime subscription scope

| Item | Detail |
|------|--------|
| **Client** | `components/portal/messaging/use-message-realtime.ts` |
| **Channel** | `messages:${threadId}` |
| **Filter** | `postgres_changes` on `public.messages`, `INSERT`, **`filter: thread_id=eq.<threadId>`** |
| **Assessment** | Subscription scope is **per active thread**, not whole-table — appropriate for minimizing realtime fan-out. |

---

## 8. Validation results

| Check | Result |
|-------|--------|
| **SQL migrations** | Manual review; additive index + `CREATE OR REPLACE FUNCTION`. |
| **Inbox API** | Same response shape; unread/count semantics aligned with `countUnreadMessagesFromOthers` test vs legacy loop. |
| **`npm run typecheck`** | Pass |
| **`npm run test:release-guards`** | Pass |
| **`npx tsx tests/message-inbox-unread-logic.test.ts`** | Pass |

**Recommended after deploy**

1. Run `scripts/phase5-readonly-diagnostics.sql` post-migration.  
2. Compare `idx_scan` / index size on `idx_notifications_user_team_unread_created`.  
3. Optional: `EXPLAIN (analyze, buffers)` on `select * from message_thread_inbox_stats($1, $2)` with real UUID arrays.  
4. Confirm migration `20260508120000_message_thread_inbox_stats_rpc.sql` applied before relying on inbox list (otherwise RPC returns error and route returns 500).

---

## 9. Follow-up work (non–Phase 5 DB or cross-cutting)

1. **Duplicate message indexes:** consolidate after proving redundancy on production.  
2. **`pg_stat_statements`:** enable if not already; sample top queries touching `messages` / `notifications`.  
3. **Stripe / billing indexes:** out of scope unless billing routes show sequential scans (future phase).  
4. **Optional:** fold latest-message preview into SQL (e.g. `DISTINCT ON`) to reduce the separate `limit 400` fetch — larger change; preview remains bounded today.

---

## 10. Files touched

| Path | Role |
|------|------|
| `PHASE_5_DATABASE_PERFORMANCE_REPORT.md` | This document |
| `scripts/phase5-readonly-diagnostics.sql` | Read-only operator playbook |
| `supabase/migrations/20260507120000_phase5_notifications_unread_partial_index.sql` | Additive partial index |
| `supabase/migrations/20260508120000_message_thread_inbox_stats_rpc.sql` | Inbox aggregate RPC |
| `app/api/messages/threads/route.ts` | Uses RPC instead of full message scan for counts |
| `lib/messaging/inbox-unread-logic.ts` | Documented unread helper |
| `tests/message-inbox-unread-logic.test.ts` | Regression guard for unread math |
