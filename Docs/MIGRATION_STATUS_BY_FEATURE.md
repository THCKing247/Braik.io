# Prisma → Supabase Migration Status by Feature

**Source of truth:** `Docs/PRISMA_MIGRATION_AUDIT.md`  
**Cross-checked against:** current repository (file contents and routes)  
**Date:** 2025-03-09  

This document lists, per feature area, what is still not migrated, what is already migrated, and what Supabase schema or callers need to change. No code was modified; this is verification and reporting only.

---

## Auth and core team

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `api/auth/signup/route.ts` (root `api/`) | POST returns 501 "Not migrated: Prisma removed. Use Supabase." | Never implemented with Supabase | Implement with `supabase.auth.signUp()` (or admin createUser where appropriate), upsert `public.users` and `profiles`, create team if head coach, write to `invites`/`team_members` as in `app/api/auth/signup-secure/route.ts`. Or redirect callers to signup-secure and deprecate this route. |
| `app/api/user/password/route.ts` | POST returns 501 "Not migrated: Prisma removed. Use Supabase." | Never implemented | Use Supabase Auth `updateUser({ password })` (server-side via service role or auth endpoint). |

### Broken lib/helpers

None in this feature area. Auth uses `lib/auth/server-auth.ts`, `lib/invites/accept-invite.ts`, `lib/invites/validate-invite.ts` — all Supabase-based.

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `signup/payment/page.tsx` | POST `/api/auth/signup` | Payment step of legacy signup flow fails with 501. |
| `signup/complete/page.tsx` | POST `/api/auth/signup` | Complete step (player/parent/assistant) fails with 501. |
| `components/portal/invite-acceptance.tsx` | POST `/api/auth/signup` when user chooses "Create account" | New user accepting invite via signup path gets 501. |
| `components/portal/settings-sections/account-settings.tsx` | POST `/api/user/password` | Change password in account settings fails with 501. |

**Already migrated (verified):**  
- `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/api/auth/session/route.ts`  
- `app/api/auth/signup-secure/route.ts` (used by `app/(auth)/signup/payment/page.tsx` and `app/(auth)/signup/complete/page.tsx`)  
- `app/api/auth/signup-with-invite/route.ts` (used by `components/invites/invite-accept-card.tsx` for signup-with-token)  
- `app/api/auth/signup-athletic-director/route.ts`  
- `app/api/invites/route.ts` POST (single invite create)  
- `app/api/invites/[id]/accept/route.ts`  
- `app/api/team/join/route.ts` (uses `invites`; see schema mismatch below)

### Missing Supabase schema

- None for auth itself. `public.users`, `profiles`, `team_members` exist. Ensure signup flows upsert `users` with id matching `auth.users.id` (or stable mapping) where RLS expects it.

### Migration blockers / schema mismatches

- **`app/api/team/join/route.ts`** uses `invites.code`, `invites.uses`, `invites.max_uses`. Current migrations only have `invites.token`, `expires_at`, `accepted_at`. Either add columns `code`, `uses`, `max_uses` to `invites` or change team/join to use `token` and remove uses/max_uses logic.

### Recommended migration order

1. Implement or replace `api/auth/signup/route.ts` (align with signup-secure or deprecate and point legacy pages to signup-secure).  
2. Implement `app/api/user/password/route.ts` with Supabase Auth password update.  
3. Resolve `invites.code` / `uses` / `max_uses` vs current schema (migration or code change).

---

## Roster and depth chart

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/roster/[playerId]/image/route.ts` | GET and POST return 501 | Never implemented | GET: return redirect or URL from `players.image_url`; POST: upload to Supabase Storage, set `players.image_url` (or store key). |
| `app/api/roster/codes/route.ts` | GET returns 501 | Never implemented | Read `teams.player_code`, `teams.parent_code`, `teams.team_id_code` for teamId; return for program-codes UI. |
| `app/api/roster/codes/update/route.ts` | Returns 501 | Never implemented | Update `teams` code columns (with uniqueness checks). |
| `app/api/roster/generate-codes/route.ts` | Returns 501 | Never implemented | Generate and write codes to `teams` (player_code, parent_code, team_id_code). |
| `app/api/roster/depth-chart/route.ts` | GET and PATCH return 501 | Never implemented | Persist depth chart: either derive from `players` (e.g. position_order) or add table `depth_chart_entries` (team_id, player_id, unit, position, order). |
| `app/api/roster/depth-chart/position-labels/route.ts` | GET and PATCH return 501 | Never implemented | Store custom position labels per team (e.g. `team_settings` or `teams` jsonb column). |
| `app/api/roster/import/route.ts` | POST returns 501 | Never implemented | Bulk insert into `players` from CSV/JSON; validate team_id and permissions. |

### Broken lib/helpers

| File path | Function name | What it currently does | What needs to replace it |
|-----------|--------------|-------------------------|---------------------------|
| `lib/utils/data-filters.ts` | `getParentAccessiblePlayerIds` | Throws "Not migrated: Prisma removed. Use Supabase." | Query `players` (+ team_members if needed) to resolve parent-accessible player IDs for the team. |
| `lib/utils/data-filters.ts` | `buildPlayerFilter` | Throws same | Build filter object/query for roster list from user role and position groups (Supabase query on `players` / `team_members`). |
| `lib/enforcement/depth-chart-permissions.ts` | `validatePlayerInRoster` | Throws same | `supabase.from("players").select("id").eq("team_id", teamId).eq("id", playerId).maybeSingle()` and return boolean. |

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/portal/roster-manager.tsx` | GET/POST `/api/roster`, POST `/api/roster/import` | Roster list works (GET migrated); add player works; import fails with 501. |
| `components/portal/roster-manager-enhanced.tsx` | `/api/roster`, `/api/roster/import`, `/api/roster/depth-chart` | Same; depth chart load/save fails. |
| `components/portal/roster-grid-view.tsx` | GET `/api/roster/[playerId]/image` | Player image fails 501. |
| `components/portal/program-codes-display.tsx` | GET `/api/roster/codes` | Program codes don’t load. |
| `components/portal/team-id-display.tsx` | POST `/api/roster/generate-codes` | Generate codes fails. |
| `components/portal/position-label-editor.tsx` | GET/PATCH `/api/roster/depth-chart/position-labels` | Position labels don’t load/save. |
| `components/portal/depth-chart-view.tsx` | GET `/api/roster/depth-chart/position-labels` | Same. |

**Already migrated (verified):**  
- `app/api/roster/route.ts` GET and POST (Supabase `players`, `teams`).

### Missing Supabase schema

- **Depth chart:** Either add columns to `players` (e.g. `depth_unit`, `depth_position`, `depth_order`) or new table e.g. `depth_chart_entries` (team_id, player_id, unit, position, sort_order).  
- **Position labels:** Optional table or `teams` jsonb (e.g. `position_labels` or `roster_settings`).  
- **Storage:** If player images are files, a Supabase Storage bucket and policy for team-scoped uploads.

### Migration blockers / schema mismatches

- None beyond missing depth-chart and position-label storage.

### Recommended migration order

1. Implement `lib/enforcement/depth-chart-permissions.ts` → `validatePlayerInRoster` (Supabase only).  
2. Implement `app/api/roster/codes/route.ts`, `codes/update/route.ts`, `generate-codes/route.ts` (read/write `teams` code columns).  
3. Implement `app/api/roster/[playerId]/image/route.ts` (and optional Storage bucket).  
4. Implement `lib/utils/data-filters.ts` → `getParentAccessiblePlayerIds`, `buildPlayerFilter` (Supabase).  
5. Add depth-chart schema (table or columns); then implement depth-chart and position-labels routes.  
6. Implement `app/api/roster/import/route.ts`.

---

## Documents

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/documents/[documentId]/route.ts` | GET and DELETE return 501 | Never implemented | GET: select from `documents` by id, check team access, return doc + file_url; DELETE: delete row (and optionally Storage object). |
| `app/api/documents/[documentId]/link/route.ts` | GET and POST return 501 | Never implemented | Link document to event: need join table e.g. `event_documents(event_id, document_id)` or similar; GET list, POST create link. |
| `app/api/events/[eventId]/documents/route.ts` | GET returns 501 | Never implemented | List documents linked to event via event_documents; return shape expected by EventDetailModal. |
| `app/api/documents/route.ts` | POST returns 501 | Stub only | Upload file to Supabase Storage, insert row into `documents` (team_id, title, file_name, file_url, category, visibility, etc.). |

### Broken lib/helpers

| File path | Function name | What it currently does | What needs to replace it |
|-----------|--------------|-------------------------|---------------------------|
| `lib/enforcement/documents-permissions.ts` | `getDocumentPermissions` | Throws "Not migrated..." | Compute canView/canCreate/canEdit/canDelete/canLink from membership role and document visibility/scoped fields (Supabase). |
| `lib/enforcement/documents-permissions.ts` | `canViewDocument`, `canEditDocument`, `canDeleteDocument` | Throw same | Same; implement with Supabase membership + document row. |

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/portal/documents-manager.tsx` | GET `/api/documents`, GET/DELETE `/api/documents/[id]`, link | List works; open/delete doc and link to event fail. |
| `components/portal/playbooks-manager.tsx` | GET `/api/documents`, link | Same for playbooks. |
| `components/portal/schedule-manager.tsx` | GET `/api/documents`, POST `/api/documents/[id]/link` | Linking document to event fails. |
| `app/(portal)/dashboard/documents/page.tsx` | GET `/api/documents` | List works. |
| `components/portal/event-detail-modal.tsx` | GET `/api/events/[eventId]/documents` | Event detail documents don’t load. |
| `components/portal/playbook-upload-form.tsx` | POST `/api/documents/upload` | Separate route; if it exists and is stubbed, upload fails. |

**Already migrated (verified):**  
- `app/api/documents/route.ts` GET (Supabase `documents` + creators).

### Missing Supabase schema

- **Event–document link:** Table e.g. `event_documents` (id, event_id, document_id, created_at) with FKs to `events` and `documents`.  
- **Storage:** Bucket for document files and RLS/policies so only team members can access.

### Migration blockers / schema mismatches

- `documents.created_by` references `public.users(id)`. Session provides `auth.uid()`. Ensure app syncs `public.users.id` with auth or use a consistent id for created_by.

### Recommended migration order

1. Add `event_documents` (or equivalent) migration.  
2. Implement `lib/enforcement/documents-permissions.ts` (all four functions) with Supabase.  
3. Implement `app/api/documents/[documentId]/route.ts` GET and DELETE.  
4. Implement `app/api/documents/[documentId]/link/route.ts` and `app/api/events/[eventId]/documents/route.ts`.  
5. Implement `app/api/documents/route.ts` POST (Storage + insert).

---

## Calendar

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/teams/[teamId]/calendar/settings/route.ts` | GET and PATCH return 501 | Never implemented | Read/write calendar settings (e.g. `teams` jsonb or table `team_calendar_settings`). |
| `app/api/teams/[teamId]/calendar/events/[eventId]/route.ts` | GET, PATCH, DELETE return 501 | Never implemented | CRUD on `events` table (select/update/delete by id, team_id). |
| `app/api/teams/[teamId]/calendar/events/[eventId]/private-notes/route.ts` | GET and PATCH return 501 | Never implemented | Store coach-only notes; need column or table (e.g. `event_private_notes` or `events.private_notes`). |

### Broken lib/helpers

| File path | Function name | What it currently does | What needs to replace it |
|-----------|--------------|-------------------------|---------------------------|
| `lib/utils/calendar-hierarchy.ts` | `getScopedPlayerIds` | Throws "Not migrated..." | Resolve player IDs from scoped_player_ids, scoped_position_groups, scoped_unit using `players` and team_members (Supabase). |

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/portal/calendar-settings.tsx` | GET/PATCH `/api/teams/[teamId]/calendar/settings` | Calendar settings don’t load/save. |
| `components/portal/settings-sections/calendar-settings-section.tsx` | Same | Same. |
| `components/portal/settings-sections/permissions-settings.tsx` | Same | Same. |
| `components/portal/team-dashboard.tsx` | GET `/api/teams/[teamId]/calendar/events` | Events list works (route migrated). |
| `app/(portal)/dashboard/schedule/page.tsx` | GET `/api/teams/[teamId]/calendar/events` | Same. |
| Schedule/event modals that edit event or private notes | PATCH/DELETE event, GET/PATCH private-notes | Event edit/delete and private notes fail. |

**Already migrated (verified):**  
- `app/api/teams/[teamId]/calendar/events/route.ts` GET (Supabase `events`).

### Missing Supabase schema

- **Calendar settings:** Column on `teams` (e.g. `calendar_settings` jsonb) or table `team_calendar_settings` (team_id, key/value or jsonb).  
- **Event private notes:** Column `events.private_notes` (text) or table `event_private_notes` (event_id, created_by, body, created_at). RLS so only permitted roles can read/write.

### Migration blockers / schema mismatches

- None; `events` table exists in migrations.

### Recommended migration order

1. Add migration for calendar settings and event private notes (column or table).  
2. Implement `lib/utils/calendar-hierarchy.ts` → `getScopedPlayerIds` with Supabase.  
3. Implement `app/api/teams/[teamId]/calendar/settings/route.ts`.  
4. Implement `app/api/teams/[teamId]/calendar/events/[eventId]/route.ts` (GET, PATCH, DELETE).  
5. Implement `app/api/teams/[teamId]/calendar/events/[eventId]/private-notes/route.ts`.

---

## Inventory

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/teams/[teamId]/inventory/[itemId]/route.ts` | GET, PATCH, DELETE return 501 | Never implemented | CRUD on `inventory_items` (select/update/delete by id, team_id). |
| `app/api/teams/[teamId]/inventory/[itemId]/transactions/route.ts` | GET and POST return 501 | Never implemented | List/create inventory transactions; need table `inventory_transactions`. |
| `app/api/teams/[teamId]/inventory/route.ts` | POST returns 501 | Stub | Insert into `inventory_items` (team_id, category, name, quantity_total, quantity_available, etc.). |

### Broken lib/helpers

| File path | Function name | What it currently does | What needs to replace it |
|-----------|--------------|-------------------------|---------------------------|
| `lib/enforcement/inventory-permissions.ts` | `getInventoryPermissions` | Throws "Not migrated..." | Derive canView/canCreate/canEdit/canDelete/canAssign from membership and team (Supabase). |
| `lib/enforcement/inventory-permissions.ts` | `canAssignToPlayer`, `canViewInventoryItem` | Throw same | Check role and optionally player assignment (Supabase). |

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/portal/inventory-manager.tsx` | GET `/api/teams/[teamId]/inventory`, PUT/DELETE `/api/teams/[teamId]/inventory/[itemId]`, POST create | List works; create/edit/delete item and transactions fail. |
| `app/(portal)/dashboard/inventory/page.tsx` | GET `/api/teams/[teamId]/inventory` | List works. |

**Already migrated (verified):**  
- `app/api/teams/[teamId]/inventory/route.ts` GET (Supabase `inventory_items`, `players`).

### Missing Supabase schema

- **Inventory transactions:** Table e.g. `inventory_transactions` (id, inventory_item_id, type e.g. check_out/check_in/assign, quantity_delta, assigned_to_player_id, performed_by, created_at). RLS for team scope.

### Migration blockers / schema mismatches

- None; `inventory_items` and `players` exist.

### Recommended migration order

1. Add `inventory_transactions` migration.  
2. Implement `lib/enforcement/inventory-permissions.ts` (all three functions) with Supabase.  
3. Implement `app/api/teams/[teamId]/inventory/route.ts` POST.  
4. Implement `app/api/teams/[teamId]/inventory/[itemId]/route.ts` (GET, PATCH, DELETE).  
5. Implement `app/api/teams/[teamId]/inventory/[itemId]/transactions/route.ts`.

---

## Messaging

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/messages/threads/route.ts` | GET returns 501 | Never implemented | List threads for team from `message_threads` (or equivalent). |
| `app/api/messages/threads/[threadId]/route.ts` | Returns 501 | Never implemented | Get thread + messages. |
| `app/api/messages/threads/create/route.ts` | POST returns 501 | Never implemented | Insert thread (and optionally first message). |
| `app/api/messages/send/route.ts` | POST returns 501 | Never implemented | Insert message into thread. |
| `app/api/messages/contacts/route.ts` | GET returns 501 | Never implemented | List contacts (e.g. team members / roster) for messaging. |
| `app/api/messages/attachments/route.ts` | POST returns 501 | Never implemented | Upload attachment, store in table + Storage. |
| `app/api/messages/attachments/[attachmentId]/route.ts` | Returns 501 | Never implemented | Get/delete attachment. |
| `app/api/messages/attachments/serve/route.ts` | Returns 501 | Never implemented | Serve or redirect to file (Storage). |

### Broken lib/helpers

| File path | Function name | What it currently does | What needs to replace it |
|-----------|--------------|-------------------------|---------------------------|
| `lib/utils/messaging-utils.ts` | `ensureGeneralChatThread` | Throws "Not migrated..." | Find or create a "general" thread for team (Supabase). |
| `lib/utils/messaging-utils.ts` | `ensureParentPlayerCoachChat` | Throws same | Find or create thread for parent–player–coach (Supabase). |

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/portal/messaging-manager.tsx` | All of the above message/thread/attachment routes | Messaging tab fully broken (threads, send, attachments). |

### Missing Supabase schema

- **message_threads:** id, team_id, type (e.g. general, direct), title, created_at, metadata (e.g. participant_ids).  
- **messages:** id, thread_id, sender_id (user), body, created_at; optional edited_at.  
- **message_attachments:** id, message_id, file_name, file_url (or storage path), mime_type, file_size, created_at.  
- **Storage:** Bucket for attachments; RLS so only thread participants (team members) can read.

### Migration blockers / schema mismatches

- Entire messaging feature depends on new tables; no Prisma-era tables exist in current migrations.

### Recommended migration order

1. Add migrations for `message_threads`, `messages`, `message_attachments` and optional Storage bucket.  
2. Implement `lib/utils/messaging-utils.ts` (ensureGeneralChatThread, ensureParentPlayerCoachChat).  
3. Implement threads list/create and single-thread routes.  
4. Implement send and contacts routes.  
5. Implement attachment upload, get, delete, serve.

---

## Payments / Stripe

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/collections/route.ts` | GET/POST return 501 | Never implemented | List/create payment collections (need `collections` or equivalent table + Stripe). |
| `app/api/collections/[collectionId]/route.ts` | GET/PATCH return 501 | Never implemented | Get/update collection by id. |
| `app/api/collections/[collectionId]/invoices/route.ts` | GET returns 501 | Never implemented | List invoices for collection. |
| `app/api/collections/[collectionId]/close/route.ts` | POST returns 501 | Never implemented | Mark collection closed. |
| `app/api/collections/mark-cash/route.ts` | POST returns 501 | Never implemented | Mark payment as cash. |
| `app/api/collections/pay-card/route.ts` | POST returns 501 | Never implemented | Card payment for collection. |
| `app/api/teams/[teamId]/payments/coach/connect/route.ts` | Returns 501 | Never implemented | Stripe Connect onboarding. |
| `app/api/teams/[teamId]/payments/coach/status/route.ts` | Returns 501 | Never implemented | Connect account status. |
| `app/api/teams/[teamId]/payments/coach/collections/route.ts` | GET/POST return 501 | Never implemented | Coach collections list/create. |
| `app/api/teams/[teamId]/payments/coach/collections/[collectionId]/route.ts` | GET/PATCH return 501 | Never implemented | Single collection. |
| `app/api/teams/[teamId]/payments/coach/collections/[collectionId]/pay/route.ts` | POST returns 501 | Never implemented | Pay collection. |
| `app/api/teams/[teamId]/payments/coach/transactions/route.ts` | GET returns 501 | Never implemented | List transactions. |
| `app/api/payments/create-checkout/route.ts` | POST returns 501 | Never implemented | Create Stripe Checkout session; persist reference if needed. |
| `app/api/payments/mark-paid/route.ts` | POST returns 501 | Never implemented | Mark invoice/item paid (DB + optional webhook). |
| `app/api/payments/export/route.ts` | GET returns 501 | Never implemented | Export payments (query DB + format CSV). |
| `app/api/webhooks/stripe/route.ts` | POST returns 501 | Never implemented | Verify Stripe signature; update `collections`/invoices/teams from webhook events. |

### Broken lib/helpers

None specific to payments; billing-state is used and partially uses Supabase (see Billing / seasons).

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/portal/collections-manager.tsx` | mark-cash, pay-card | Mark cash/card payments fail. |
| `components/portal/collection-detail.tsx` | GET collection, close | View/close collection fail. |
| `components/portal/invoice-list.tsx` | GET collection invoices | Invoices don’t load. |
| `components/portal/payments-manager.tsx` | create-checkout, mark-paid, export | Checkout, mark paid, export fail. |

### Missing Supabase schema

- **collections** (or equivalent): id, team_id, stripe_id?, status, type, due_at, closed_at, created_at, metadata.  
- **invoices / payment_items:** Link to collection, amount, status, stripe_id?, paid_at, etc.  
- **Coach Stripe Connect:** e.g. `teams.stripe_connect_account_id` or `coach_stripe_accounts` table.  
- Optional: **payment_transactions** for history and export.

### Migration blockers / schema mismatches

- No payment tables in current migrations; full design needed alongside Stripe integration.

### Recommended migration order

1. Add migrations for collections, invoices (and optional transactions), and coach Connect fields.  
2. Implement Stripe webhook route (verify signature, idempotency).  
3. Implement coach connect and status routes.  
4. Implement collections CRUD and close; then mark-cash, pay-card, pay.  
5. Implement create-checkout, mark-paid, export.

---

## Plays

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/plays/route.ts` | GET and POST return 501 | Never implemented | List/create plays for team (need `plays` table). |
| `app/api/plays/[playId]/route.ts` | GET, PATCH, DELETE return 501 | Never implemented | Get/update/delete play by id. |

### Broken lib/helpers

None.

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/portal/playbook-builder-v2.tsx` | POST `/api/plays` | Save play fails. |
| `components/portal/playbooks-page-client.tsx` | GET `/api/plays`, GET/PATCH/DELETE `/api/plays/[playId]` | List/edit/delete plays fail. |
| `components/portal/playbooks-landing.tsx` | GET `/api/plays` | List fails. |
| `components/portal/playbook-viewer.tsx` | GET `/api/plays` | List fails. |
| `components/portal/playbook-library.tsx` | GET `/api/plays` | List fails. |

### Missing Supabase schema

- **plays:** id, team_id, name, description, diagram_data (jsonb?), created_by, created_at, updated_at. Optional: category, thumbnail_url.

### Migration blockers / schema mismatches

- No `plays` table in migrations.

### Recommended migration order

1. Add `plays` table migration.  
2. Implement `app/api/plays/route.ts` (GET list, POST create).  
3. Implement `app/api/plays/[playId]/route.ts` (GET, PATCH, DELETE).

---

## Billing / seasons / games

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/teams/[teamId]/season/route.ts` | GET and PATCH return 501 | Never implemented | Read/update season for team (use `seasons` table or team-level season fields). |
| `app/api/teams/rollover/route.ts` | POST returns 501 | Never implemented | Create next season, copy or reset data; update teams/players as needed. |

### Broken lib/helpers

None that throw; `lib/billing/billing-state.ts` is partially migrated: `getTeamBillingState` reads `teams` and returns state, but `updateFirstGameWeekDate` and any path that needs `games`/`seasons` depend on missing tables.

### Broken UI dependencies

- Team summary/settings that show season or rollover will call these routes; exact pages to confirm. Billing state is used by guards (e.g. team-operation-guard); with BILLING_ENFORCED false, UI may not visibly break.

### Missing Supabase schema

- **seasons:** id, team_id, season_year, start_date, end_date, first_game_week_date, subscription_due_date, amount_paid, subscription_amount, ai_enabled, etc. (or part of this on `teams`).  
- **games:** id, team_id or season_id, date, opponent?, confirmed_by_coach (boolean), etc.  
- **teams:** If billing uses team-level fields: season_start, season_end, subscription_due_date, amount_paid, subscription_amount, ai_enabled, ai_disabled_by_platform, account_status. Current migrations add various columns across files; ensure these exist where billing-state expects them.

### Migration blockers / schema mismatches

- `lib/billing/billing-state.ts` → `getTeamBillingState` reads `teams` and expects optional fields (season_start, season_end, subscription_due_date, amount_paid, subscription_amount, ai_enabled, ai_disabled_by_platform, account_status). If missing, defaults or nulls are used.  
- `updateFirstGameWeekDate(seasonId)` queries `games` and updates `seasons`; both tables are absent from migrations. Either add them or remove/guard that function.

### Recommended migration order

1. Add `seasons` and `games` tables (and any missing `teams` columns) per billing design.  
2. Implement `app/api/teams/[teamId]/season/route.ts`.  
3. Implement `app/api/teams/rollover/route.ts`.  
4. Align `getTeamBillingState` and `updateFirstGameWeekDate` with new schema.

---

## AI

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/ai/propose-action/route.ts` | POST returns 501 | Never implemented | Create proposal (e.g. `ai_proposals` or reuse `agent_actions`), return proposal id. |
| `app/api/ai/confirm-action/route.ts` | POST returns 501 | Never implemented | Execute confirmed action; update usage/proposal state. |
| `app/api/ai/chat/route.ts` | POST returns 501 | Never implemented | Chat with AI; record usage. |
| `app/api/ai/upload/route.ts` | POST returns 501 | Never implemented | Upload context file; optionally store in Storage. |
| `app/api/ai-assistant/route.ts` | POST returns 501 | Never implemented | AI assistant endpoint (stream or JSON). |

### Broken lib/helpers

| File path | Function name | What it currently does | What needs to replace it |
|-----------|--------------|-------------------------|---------------------------|
| `lib/ai/ai-utils.ts` | `getOrCreateAIUsage` | Throws "Not migrated..." | Get or create row in `ai_usage` (or equivalent) for team/season. |
| `lib/ai/ai-utils.ts` | `recordAIUsage` | Throws same | Insert or update usage. |
| `lib/ai/ai-utils.ts` | `getAIUsageStatus` | Throws same | Aggregate usage and return status. |
| `lib/ai/ai-utils.ts` | `isAIEnabled` | Throws same | Check team/platform AI flags (Supabase). |
| `lib/ai/ai-actions.ts` | `executeSafeAction` | Throws same | Run action and persist (e.g. agent_actions). |
| `lib/ai/ai-actions.ts` | `createActionProposal` | Throws same | Store proposal for approval. |
| `lib/ai/ai-actions.ts` | `executeConfirmedAction` | Throws same | Execute by proposal id and record. |

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/ai/ai-chatbot-widget.tsx` | POST `/api/ai/chat`, POST `/api/ai/upload` | Chat and file upload fail. |
| `components/ai/ai-action-confirmation.tsx` | POST `/api/ai/confirm-action` | Confirm action fails. |

### Missing Supabase schema

- **AI usage:** e.g. `ai_usage` (team_id, season_year, tokens_used, last_updated) or per-request log table.  
- **Proposals:** e.g. `ai_proposals` (id, team_id, user_id, action_type, payload, status, created_at) or extend `agent_actions` (20260226 has agent_actions with team_id, user_id, action_type, etc.).  
- **Storage:** Optional bucket for AI uploads.

### Migration blockers / schema mismatches

- 20260226 has `agent_actions`; confirm whether proposals and usage live there or in separate tables.

### Recommended migration order

1. Define and add ai_usage and/or ai_proposals (or align with agent_actions).  
2. Implement `lib/ai/ai-utils.ts` (getOrCreateAIUsage, recordAIUsage, getAIUsageStatus, isAIEnabled).  
3. Implement `lib/ai/ai-actions.ts` (executeSafeAction, createActionProposal, executeConfirmedAction).  
4. Implement propose-action and confirm-action routes.  
5. Implement chat, upload, ai-assistant routes.

---

## Admin / support

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/admin/teams/[teamId]/route.ts` | GET and PATCH return 501 | Never implemented | Admin get/update team (Supabase `teams`). |
| `app/api/admin/teams/[teamId]/service-status/route.ts` | GET/PATCH return 501 | Never implemented | Get/update team service status (e.g. status column on teams). |
| `app/api/admin/teams/[teamId]/ai/route.ts` | GET/PATCH return 501 | Never implemented | Get/update team AI settings/credits. |
| `app/api/admin/announcements/route.ts` | GET/POST return 501 | Never implemented | List/create from `announcements` table. |
| `app/api/admin/users/[userId]/password/route.ts` | PATCH returns 501 | Never implemented | Admin set user password (Supabase Auth admin). |
| `app/api/admin/users/[userId]/password-reset/route.ts` | POST returns 501 | Never implemented | Send or perform password reset. |
| `app/api/admin/users/[userId]/status/route.ts` | PATCH returns 501 | Never implemented | Update user status (e.g. `users.status`). |
| `app/api/admin/users/[userId]/ai-credits/route.ts` | GET/PATCH return 501 | Never implemented | Read/update user AI credits (e.g. `users.ai_credits_remaining`). |
| `app/api/admin/support/tickets/route.ts` | GET/POST return 501 | Never implemented | List/create `support_tickets`. |
| `app/api/admin/support/tickets/[ticketId]/route.ts` | GET/PATCH return 501 | Never implemented | Get/update ticket. |
| `app/api/admin/support/tickets/[ticketId]/messages/route.ts` | GET/POST return 501 | Never implemented | List/add `support_messages`. |
| `app/api/support/tickets/route.ts` | POST returns 501 | Never implemented | Create ticket (coach-facing); insert into support_tickets. |

### Broken lib/helpers

None; admin-access and audit use Supabase.

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/admin/admin-team-detail-actions.tsx` | GET/PATCH admin team, GET/PATCH admin team AI | Admin team and AI actions fail. |
| `components/admin/admin-team-status-form.tsx` | GET/PATCH service-status | Service status form fails. |
| `components/admin/admin-user-detail-actions.tsx` | GET/DELETE user, password-reset, ai-credits | User actions fail. |
| `components/admin/admin-announcement-form.tsx` | POST admin announcements | Create announcement fails. |
| `components/admin/admin-ticket-status-form.tsx` | GET/PATCH ticket | Ticket status fails. |
| `components/admin/admin-ticket-message-form.tsx` | POST ticket messages | Reply to ticket fails. |
| `components/admin/operator-users.tsx` | GET/PATCH/DELETE user (and impersonation) | User list/detail work (GET/PATCH/DELETE migrated); password-reset and ai-credits fail. |
| `app/(admin)/admin/(protected)/*` (8 placeholder pages) | Various admin APIs | Full admin section shows "temporarily unavailable" until routes and pages are restored. |

**Already migrated (verified):**  
- `app/api/admin/users/route.ts` GET  
- `app/api/admin/users/[userId]/route.ts` GET, PATCH, DELETE  
- `app/api/admin/audit-logs/route.ts`  
- `app/api/admin/access-denied/route.ts`  
- Impersonation start/end (used by admin UI).

### Missing Supabase schema

- **support_tickets** and **support_messages** exist in 20260225_admin_portal.sql.  
- **announcements** exists.  
- **users** has (or 20260226 adds) ai_credits_remaining, ai_tier, ai_auto_recharge_enabled.  
- **teams** may need service_status or similar for admin.

### Migration blockers / schema mismatches

- None; tables exist. Routes only need to be implemented against existing schema.

### Recommended migration order

1. Implement admin team routes (GET/PATCH team, service-status, AI).  
2. Implement admin user routes (password, password-reset, status, ai-credits).  
3. Implement admin announcements and support tickets/messages.  
4. Implement coach-facing POST support/tickets.  
5. Replace placeholder admin pages with real UI wired to these APIs.

---

## Invites / memberships / notifications / team summary / team updates

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/invites/bulk/route.ts` | POST returns 501 | Never implemented | Create multiple invites (loop or bulk insert into `invites`). |
| `app/api/invites/[id]/resend/route.ts` | POST returns 501 | Never implemented | Regenerate token/expiry and optionally resend email; update `invites`. |
| `app/api/teams/[teamId]/memberships/[membershipId]/route.ts` | GET/PATCH/DELETE return 501 | Never implemented | Get/update/deactivate `team_members` row by id. |
| `app/api/teams/[teamId]/summary/route.ts` | GET returns 501 | Never implemented | Aggregate counts (roster, events, etc.) from players, events, etc. |
| `app/api/teams/[teamId]/updates/route.ts` | GET returns 501 | Never implemented | List "updates" (announcements or activity); need definition and possibly table. |
| `app/api/teams/[teamId]/route.ts` | GET/PATCH return 501 | Never implemented | Get/update team by id (Supabase `teams`). |
| `app/api/announcements/route.ts` | GET returns 501 | Never implemented | List announcements for head coach (filter by team; use `announcements`). |
| `app/api/notifications/preferences/route.ts` | GET and PATCH return 501 | Never implemented | User notification preferences; need `notification_preferences` or similar. |

### Broken lib/helpers

None in this group.

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/portal/invite-manager.tsx` | POST invites/bulk, POST invites/[id]/resend | Bulk invite and resend fail. |
| (Team settings / dashboard) | GET team summary, updates, team CRUD | Summary and updates and team edit fail if those endpoints are used. |
| `components/portal/notifications-widget.tsx` | GET/PATCH `/api/notifications` (done), PATCH/DELETE `[id]` (done), mark-all-read (done). Preferences: GET/PATCH `/api/notifications/preferences` | Only preferences are stubbed; widget may partially work. |

**Already migrated (verified):**  
- `app/api/invites/route.ts` POST (single invite)  
- `app/api/invites/[id]/accept/route.ts`  
- `app/api/notifications/route.ts` GET  
- `app/api/notifications/[id]/route.ts` PATCH, DELETE  
- `app/api/notifications/mark-all-read/route.ts` POST  

### Missing Supabase schema

- **Notification preferences:** Table or column (e.g. `user_notification_preferences` or `profiles.notification_preferences` jsonb).  
- **Team updates:** If distinct from announcements, define (e.g. `team_updates` or use announcements with scope).

### Migration blockers / schema mismatches

- None critical; `invites`, `team_members`, `announcements` exist.

### Recommended migration order

1. Implement `app/api/teams/[teamId]/route.ts` (GET, PATCH).  
2. Implement `app/api/teams/[teamId]/memberships/[membershipId]/route.ts`.  
3. Implement `app/api/teams/[teamId]/summary/route.ts`.  
4. Implement `app/api/teams/[teamId]/updates/route.ts` (and schema if needed).  
5. Implement `app/api/invites/bulk/route.ts` and `app/api/invites/[id]/resend/route.ts`.  
6. Implement `app/api/announcements/route.ts` GET.  
7. Add notification preferences schema; implement `app/api/notifications/preferences/route.ts`.

---

## Compliance

### Broken routes

| Path | What it currently does | Why not migrated | Supabase replacement needed |
|------|------------------------|------------------|-----------------------------|
| `app/api/compliance/logs/route.ts` | GET returns 501 | Never implemented | List (and CSV export) from `compliance_log` (filter by user/team if needed). |
| `app/api/compliance/minor-consent/verify/route.ts` | POST returns 501 | Never implemented | Verify and optionally log consent in `compliance_log`. |

### Broken UI dependencies

| Component/page path | API/helper it depends on | User-facing impact |
|--------------------|--------------------------|---------------------|
| `components/portal/settings-sections/compliance-legal-settings.tsx` | GET `/api/compliance/logs`, GET `/api/compliance/logs?format=csv`, link to parental-consent-form | Log list and CSV export fail; PDF download works (parental-consent-form is implemented). |

**Already migrated (verified):**  
- `app/api/compliance/parental-consent-form/route.ts` GET (returns PDF).

### Missing Supabase schema

- `compliance_log` exists in 20260303 (user_id, event_type, policy_version, timestamp, ip_address, metadata). No extra schema needed for basic list/verify.

### Recommended migration order

1. Implement `app/api/compliance/logs/route.ts` (GET list + CSV).  
2. Implement `app/api/compliance/minor-consent/verify/route.ts`.

---

# Master checklist of remaining migration work

- [ ] **Auth:** `api/auth/signup/route.ts`, `app/api/user/password/route.ts`; resolve team/join vs invites schema (code/uses/max_uses).  
- [ ] **Roster/depth:** roster image, codes (get/update/generate), depth-chart, position-labels, import; data-filters (2), depth-chart-permissions (1).  
- [ ] **Documents:** documents [documentId] GET/DELETE, link, events/[eventId]/documents; documents POST; event_documents table; documents-permissions (4).  
- [ ] **Calendar:** calendar settings, events [eventId] CRUD, private-notes; calendar-hierarchy getScopedPlayerIds; schema for settings and private notes.  
- [ ] **Inventory:** inventory [itemId] CRUD, transactions route; inventory route POST; inventory_transactions table; inventory-permissions (3).  
- [ ] **Messaging:** All message/thread/attachment routes (8); messaging-utils (2); message_threads, messages, message_attachments tables + Storage.  
- [ ] **Payments/Stripe:** All collection and coach payment routes (16); webhook; collections/invoices (and optional transactions) schema; coach Connect.  
- [ ] **Plays:** plays and plays/[playId] routes; plays table.  
- [ ] **Billing/seasons:** seasons, games tables (+ teams columns if needed); season route; rollover route; billing-state alignment.  
- [ ] **AI:** propose-action, confirm-action, chat, upload, ai-assistant; ai-utils (4), ai-actions (3); ai_usage / proposals schema.  
- [ ] **Admin/support:** Admin team (3), user (4), announcements (1), support (3) routes; coach support ticket create; restore 8 admin pages.  
- [ ] **Invites/memberships/notifications/summary/updates:** team route GET/PATCH; memberships [id]; summary; updates; invites bulk + resend; announcements GET; notification preferences schema + route.  
- [ ] **Compliance:** logs route (list + CSV), minor-consent/verify.

---

# Quick wins (easiest remaining migrations)

1. **Compliance logs** – `app/api/compliance/logs/route.ts`: single table `compliance_log`, read + CSV; no new schema.  
2. **Roster codes** – `app/api/roster/codes/route.ts`, `codes/update/route.ts`, `generate-codes/route.ts`: `teams` already has player_code, parent_code, team_id_code.  
3. **validatePlayerInRoster** – `lib/enforcement/depth-chart-permissions.ts`: one Supabase query.  
4. **Team CRUD** – `app/api/teams/[teamId]/route.ts` GET/PATCH: direct `teams` read/update.  
5. **Announcements list** – `app/api/announcements/route.ts` GET: table exists, filter by team/scope.  
6. **Invites bulk** – `app/api/invites/bulk/route.ts`: loop existing invite create or bulk insert.  
7. **Invites resend** – `app/api/invites/[id]/resend/route.ts`: update token/expires_at, optional email.  
8. **User password** – `app/api/user/password/route.ts`: Supabase Auth updateUser password.  
9. **Documents [documentId] GET/DELETE** – after permissions: read/delete from `documents` (+ optional Storage).  
10. **Calendar events [eventId]** – CRUD on existing `events` table.

---

# Production blockers (most urgent broken features)

1. **Auth signup** – `api/auth/signup/route.ts` returns 501; legacy signup and invite-acceptance (create account) flows fail.  
2. **User password change** – Account settings change-password fails.  
3. **Compliance logs** – Coaches cannot view or export compliance logs.  
4. **Roster import** – Bulk roster add fails.  
5. **Program codes** – Generate/view/update team codes fail (onboarding and roster UX).  
6. **Documents** – Delete and link-to-event broken; upload (POST) stub.  
7. **Calendar event edit/delete and private notes** – Schedule management incomplete.  
8. **Inventory** – Create/edit/delete items and transactions fail.  
9. **Messaging** – Entire tab broken (no threads, send, or attachments).  
10. **Payments** – Collections, coach payments, checkout, export, webhook all stubbed.  
11. **Plays** – Playbooks list/save/edit/delete fail.  
12. **Admin panel** – All 8 protected admin pages placeholder; admin team/user/announcement/support APIs stubbed.

---

# Recommended order of execution (whole migration)

1. **Quick wins and auth (unblock users)**  
   - User password route.  
   - Compliance logs route.  
   - Auth signup route (or redirect to signup-secure and fix callers).  
   - Resolve team/join vs invites schema.

2. **Roster and codes**  
   - validatePlayerInRoster; data-filters.  
   - Roster codes (get, update, generate); roster image; depth-chart schema + routes; import.

3. **Documents and calendar**  
   - event_documents migration.  
   - documents-permissions.  
   - documents [documentId] GET/DELETE/link; events [eventId]/documents.  
   - documents POST (Storage + insert).  
   - Calendar settings + private notes schema; calendar-hierarchy; calendar routes.

4. **Inventory**  
   - inventory_transactions migration; inventory-permissions.  
   - Inventory POST and [itemId] CRUD and transactions.

5. **Team and invites**  
   - teams [teamId] GET/PATCH; memberships; summary; updates.  
   - Invites bulk and resend; announcements GET.  
   - Notification preferences (schema + route).

6. **Messaging**  
   - message_threads, messages, message_attachments (+ Storage).  
   - messaging-utils; all message/thread/attachment routes.

7. **Plays**  
   - plays table; plays and plays/[playId] routes.

8. **Billing and seasons**  
   - seasons, games (and teams columns); billing-state; season and rollover routes.

9. **Payments and Stripe**  
   - collections/invoices (and coach Connect) schema; webhook; all payment routes.

10. **AI**  
    - ai_usage / proposals (or agent_actions); ai-utils and ai-actions; propose/confirm/chat/upload/ai-assistant.

11. **Admin and support**  
    - All admin team, user, announcements, support routes; coach support ticket create; replace 8 admin placeholder pages.

This order prioritizes unblocking signup/password and compliance, then core team/roster/documents/calendar/inventory, then messaging, plays, billing, payments, AI, and finally full admin.
