# Prisma → Supabase Migration Audit Report

**Date:** 2025-03-09  
**Scope:** Full codebase scan for remaining Prisma usage, stubbed routes, schema gaps, and migration checklist.

---

## 1. Remaining Prisma Usage

### 1.1 Direct Prisma Imports / Client

| Finding | Status |
|--------|--------|
| `lib/prisma` module | **Removed** – no file exists |
| `import … from "lib/prisma"` or `@/lib/prisma` | **None** in `.ts`/`.tsx` |
| `@prisma/client` or `Prisma.` types | **None** in code |
| Prisma in `package.json` | **Removed** – no Prisma dependency |

**Conclusion:** No active Prisma client or imports remain. The codebase is Prisma-free at the import level.

---

## 2. Files Still Dependent on Prisma (Stubbed / Throw)

These files return **501** or **throw** with message *"Not migrated: Prisma removed. Use Supabase."* They are the call sites that still need Supabase implementations.

### 2.1 API Routes (return 501)

| File | Methods | Domain |
|------|--------|--------|
| `app/api/messages/threads/[threadId]/route.ts` | (all) | Messaging |
| `app/api/messages/attachments/serve/route.ts` | (all) | Messaging |
| `app/api/messages/attachments/route.ts` | (all) | Messaging |
| `app/api/messages/attachments/[attachmentId]/route.ts` | (all) | Messaging |
| `app/api/messages/threads/route.ts` | (all) | Messaging |
| `app/api/messages/threads/create/route.ts` | (all) | Messaging |
| `app/api/messages/send/route.ts` | (all) | Messaging |
| `app/api/messages/contacts/route.ts` | (all) | Messaging |
| `app/api/roster/[playerId]/image/route.ts` | (all) | Roster |
| `app/api/roster/codes/route.ts` | (all) | Roster / codes |
| `app/api/roster/codes/update/route.ts` | (all) | Roster / codes |
| `app/api/roster/depth-chart/route.ts` | (all) | Depth chart |
| `app/api/roster/depth-chart/position-labels/route.ts` | (all) | Depth chart |
| `app/api/roster/generate-codes/route.ts` | (all) | Roster / codes |
| `app/api/roster/import/route.ts` | (all) | Roster import |
| `app/api/collections/route.ts` | (all) | Payments / collections |
| `app/api/collections/[collectionId]/route.ts` | (all) | Payments |
| `app/api/collections/[collectionId]/invoices/route.ts` | (all) | Payments |
| `app/api/collections/[collectionId]/close/route.ts` | (all) | Payments |
| `app/api/collections/mark-cash/route.ts` | (all) | Payments |
| `app/api/collections/pay-card/route.ts` | (all) | Payments |
| `app/api/documents/[documentId]/route.ts` | GET, DELETE | Documents |
| `app/api/documents/[documentId]/link/route.ts` | (all) | Documents |
| `app/api/events/[eventId]/documents/route.ts` | (all) | Events / documents |
| `app/api/ai/propose-action/route.ts` | (all) | AI |
| `app/api/ai/confirm-action/route.ts` | (all) | AI |
| `app/api/ai/chat/route.ts` | (all) | AI |
| `app/api/ai/upload/route.ts` | (all) | AI |
| `app/api/ai-assistant/route.ts` | (all) | AI assistant |
| `app/api/teams/[teamId]/payments/coach/collections/[collectionId]/pay/route.ts` | (all) | Coach payments |
| `app/api/teams/[teamId]/payments/coach/collections/[collectionId]/route.ts` | (all) | Coach payments |
| `app/api/teams/[teamId]/payments/coach/collections/route.ts` | (all) | Coach payments |
| `app/api/teams/[teamId]/payments/coach/status/route.ts` | (all) | Coach payments |
| `app/api/teams/[teamId]/payments/coach/connect/route.ts` | (all) | Coach payments |
| `app/api/teams/[teamId]/payments/coach/transactions/route.ts` | (all) | Coach payments |
| `app/api/teams/[teamId]/updates/route.ts` | (all) | Team updates |
| `app/api/teams/[teamId]/summary/route.ts` | (all) | Team summary |
| `app/api/teams/[teamId]/season/route.ts` | (all) | Season |
| `app/api/teams/[teamId]/calendar/settings/route.ts` | (all) | Calendar |
| `app/api/teams/[teamId]/calendar/events/[eventId]/route.ts` | (all) | Calendar events |
| `app/api/teams/[teamId]/calendar/events/[eventId]/private-notes/route.ts` | (all) | Calendar |
| `app/api/teams/[teamId]/inventory/[itemId]/route.ts` | (all) | Inventory |
| `app/api/teams/[teamId]/inventory/[itemId]/transactions/route.ts` | (all) | Inventory |
| `app/api/teams/[teamId]/memberships/[membershipId]/route.ts` | (all) | Memberships |
| `app/api/teams/[teamId]/route.ts` | (all) | Team CRUD |
| `app/api/teams/rollover/route.ts` | (all) | Season rollover |
| `app/api/plays/route.ts` | (all) | Playbooks |
| `app/api/plays/[playId]/route.ts` | (all) | Playbooks |
| `app/api/compliance/logs/route.ts` | (all) | Compliance |
| `app/api/compliance/minor-consent/verify/route.ts` | (all) | Compliance |
| `app/api/payments/export/route.ts` | (all) | Payments |
| `app/api/payments/create-checkout/route.ts` | (all) | Payments |
| `app/api/payments/mark-paid/route.ts` | (all) | Payments |
| `app/api/webhooks/stripe/route.ts` | (all) | Stripe webhooks |
| `app/api/invites/bulk/route.ts` | (all) | Invites |
| `app/api/invites/[id]/resend/route.ts` | (all) | Invites |
| `app/api/announcements/route.ts` | (all) | Announcements |
| `app/api/notifications/preferences/route.ts` | (all) | Notifications |
| `app/api/admin/teams/[teamId]/ai/route.ts` | (all) | Admin / AI |
| `app/api/admin/teams/[teamId]/route.ts` | (all) | Admin teams |
| `app/api/admin/teams/[teamId]/service-status/route.ts` | (all) | Admin |
| `app/api/admin/announcements/route.ts` | (all) | Admin announcements |
| `app/api/admin/users/[userId]/password-reset/route.ts` | (all) | Admin users |
| `app/api/admin/users/[userId]/password/route.ts` | (all) | Admin users |
| `app/api/admin/users/[userId]/status/route.ts` | (all) | Admin users |
| `app/api/admin/support/tickets/route.ts` | (all) | Support |
| `app/api/admin/support/tickets/[ticketId]/route.ts` | (all) | Support |
| `app/api/admin/support/tickets/[ticketId]/messages/route.ts` | (all) | Support |
| `app/api/user/password/route.ts` | (all) | User password |
| `api/auth/signup/route.ts` | (all) | Auth signup |

### 2.2 Library / Utility Files (throw at runtime)

| File | Functions that throw |
|------|------------------------|
| `lib/utils/data-filters.ts` | `getParentAccessiblePlayerIds`, `buildPlayerFilter` |
| `lib/utils/messaging-utils.ts` | `ensureGeneralChatThread`, `ensureParentPlayerCoachChat` |
| `lib/utils/calendar-hierarchy.ts` | `getScopedPlayerIds` |
| `lib/enforcement/documents-permissions.ts` | `getDocumentPermissions`, `canViewDocument`, `canEditDocument`, `canDeleteDocument` |
| `lib/enforcement/inventory-permissions.ts` | `getInventoryPermissions`, `canAssignToPlayer`, `canViewInventoryItem` |
| `lib/enforcement/depth-chart-permissions.ts` | `validatePlayerInRoster` |
| `lib/ai/ai-utils.ts` | `getOrCreateAIUsage`, `recordAIUsage`, `getAIUsageStatus`, `isAIEnabled` |
| `lib/ai/ai-actions.ts` | `executeSafeAction`, `createActionProposal`, `executeConfirmedAction` |

---

## 3. Files That Will Break in Production (Prisma Stubbed)

Any **client or server code** that calls the routes or lib functions above will see **501** or **unhandled errors** in production.

### 3.1 Frontend / Components Calling Stubbed APIs

| Component | Endpoints / behavior |
|-----------|----------------------|
| `components/portal/messaging-manager.tsx` | `/api/messages/*` (threads, contacts, send, attachments) |
| `components/portal/roster-manager.tsx` | `/api/roster`, `/api/roster/import` |
| `components/portal/roster-manager-enhanced.tsx` | `/api/roster`, `/api/roster/import`, `/api/roster/depth-chart` |
| `components/portal/roster-grid-view.tsx` | `/api/roster/[playerId]/image` |
| `components/portal/program-codes-display.tsx` | `/api/roster/codes` |
| `components/portal/team-id-display.tsx` | `/api/roster/generate-codes` |
| `components/portal/position-label-editor.tsx` | `/api/roster/depth-chart/position-labels` |
| `components/portal/depth-chart-view.tsx` | `/api/roster/depth-chart/position-labels` |
| `components/portal/documents-manager.tsx` | `/api/documents`, `/api/documents/[id]` (GET/DELETE/link stubbed) |
| `components/portal/playbooks-manager.tsx` | `/api/documents` (link stubbed) |
| `components/portal/schedule-manager.tsx` | `/api/documents`, `/api/documents/[id]/link` |
| `components/portal/playbook-builder-v2.tsx` | `/api/plays` |
| `components/portal/playbooks-page-client.tsx` | `/api/plays`, `/api/plays/[playId]` |
| `components/portal/playbooks-landing.tsx` | `/api/plays` |
| `components/portal/playbook-viewer.tsx` | `/api/plays` |
| `components/portal/playbook-library.tsx` | `/api/plays` |
| `components/portal/collections-manager.tsx` | `/api/collections/mark-cash`, `/api/collections/pay-card` |
| `components/portal/collection-detail.tsx` | `/api/collections/[id]`, `/api/collections/[id]/close` |
| `components/portal/invoice-list.tsx` | `/api/collections/[id]/invoices` |
| `components/portal/payments-manager.tsx` | `/api/payments/create-checkout`, `/api/payments/mark-paid`, `/api/payments/export` |
| `components/portal/invite-manager.tsx` | `/api/invites/bulk`, `/api/invites/[id]/resend` |
| `components/portal/settings-sections/account-settings.tsx` | `/api/user/password` |
| `components/portal/settings-sections/compliance-legal-settings.tsx` | `/api/compliance/logs` (export works; list may be stubbed) |
| `components/portal/calendar-settings.tsx` | `/api/teams/[teamId]/calendar/settings` |
| `components/portal/settings-sections/calendar-settings-section.tsx` | same |
| `components/portal/settings-sections/permissions-settings.tsx` | same |
| `components/portal/inventory-manager.tsx` | `/api/teams/[teamId]/inventory/[itemId]` (PUT/DELETE stubbed) |
| `components/portal/notifications-widget.tsx` | `/api/notifications/preferences` (if used) |
| `components/ai/ai-chatbot-widget.tsx` | `/api/ai/chat`, `/api/ai/upload` |
| `components/ai/ai-action-confirmation.tsx` | `/api/ai/confirm-action` |
| `components/admin/admin-ticket-message-form.tsx` | `/api/admin/support/tickets/[id]/messages` |
| `components/admin/admin-ticket-status-form.tsx` | `/api/admin/support/tickets/[id]` |
| `components/admin/admin-team-status-form.tsx` | `/api/admin/teams/[id]/service-status` |
| `components/admin/admin-team-detail-actions.tsx` | `/api/admin/teams/[id]`, `/api/admin/teams/[id]/ai` |
| `components/admin/admin-user-detail-actions.tsx` | `/api/admin/users/[id]`, password-reset, ai-credits, DELETE |
| `components/admin/admin-announcement-form.tsx` | `/api/admin/announcements` |
| `app/(marketing)/signup/payment/page.tsx` | `/api/auth/signup` (stubbed) |
| `components/portal/invite-acceptance.tsx` | `/api/auth/signup` (when signing up) |
| `signup/complete/page.tsx` | `/api/auth/signup` |
| `app/(auth)/signup/complete/page.tsx` | `/api/auth/signup-secure` (this route is implemented; signup is stubbed) |

### 3.2 Admin Pages (Placeholder UI)

These pages show *"This feature is temporarily unavailable while migrating to Supabase"* and rely on stubbed APIs or missing data:

- `app/(admin)/admin/(protected)/audit/page.tsx`
- `app/(admin)/admin/(protected)/users/[id]/page.tsx`
- `app/(admin)/admin/(protected)/announcements/page.tsx`
- `app/(admin)/admin/(protected)/billing/page.tsx`
- `app/(admin)/admin/(protected)/tickets/page.tsx`
- `app/(admin)/admin/(protected)/teams/[id]/page.tsx`
- `app/(admin)/admin/(protected)/settings/system/page.tsx`
- `app/(admin)/admin/(protected)/ai/page.tsx`

---

## 4. Database Tables Referenced But Not Migrated

Supabase migrations define (among others):  
`users`, `teams`, `team_members`, `profiles`, `invites`, `events`, `notifications`, `compliance_log`, `audit_logs`, `support_tickets`, `support_messages`, `announcements`, `players`, `documents`, `document_acknowledgements`, `inventory_items`, `schools`, `athletic_departments`, `system_config`.

The following are **referenced in code but have no Supabase migration** (or are ambiguous):

| Table / concept | Referenced in | Notes |
|-----------------|---------------|--------|
| **games** | `lib/billing/billing-state.ts` (`updateFirstGameWeekDate`) | Used for first game week date; no `games` table in migrations. |
| **seasons** | `lib/billing/billing-state.ts` (`getTeamBillingState`, `updateFirstGameWeekDate`) | `first_game_week_date`, season lifecycle; no `seasons` table in migrations. |
| **Payment collections** | Multiple `app/api/collections/*` and payment routes | No `collections` (or equivalent) table in migrations. Stripe-related state not in DB. |
| **Message threads / attachments** | Messaging API routes, `lib/utils/messaging-utils.ts` | No `message_threads`, `messages`, or `attachments` tables in migrations. |
| **Plays** | `app/api/plays/*` | No `plays` table in migrations. |
| **Depth chart (store)** | `app/api/roster/depth-chart/*`, roster components | Depth chart may be derived from `players` or need a dedicated table; not clearly defined in migrations. |
| **Event private notes** | `app/api/teams/[teamId]/calendar/events/[eventId]/private-notes/route.ts` | `events` exists; no `event_private_notes` (or similar) in migrations. |
| **Inventory transactions** | `app/api/teams/[teamId]/inventory/[itemId]/transactions/route.ts` | No `inventory_transactions` (or similar) in migrations. |
| **AI usage / proposals** | `lib/ai/ai-utils.ts`, `lib/ai/ai-actions.ts`, AI routes | 20260226 has `agent_actions`; no clear `ai_usage` or `ai_proposals` table. |
| **subscriptions** | 20260226_super_admin_console.sql | Exists in one migration; 20260303 uses `teams.plan_tier`. Overlap with billing-state (games/seasons) needs alignment. |

---

## 5. Schema Assumptions That May Not Match Supabase

- **auth.uid() vs public.users.id:**  
  RLS and app code assume `public.users.id` can equal `auth.uid()`. Migrations and login/signup flows must keep `public.users` in sync with `auth.users` (e.g. by using same id or a stable mapping).

- **audit_logs:**  
  20260225 uses `action`, `metadata`; 20260226 defines `action_type`, `metadata_json`. With `create table if not exists`, the first migration wins. Code (e.g. `lib/audit/admin-audit.ts`) uses `action` and `metadata` — consistent with 20260225.

- **teams:**  
  20260225: `plan_tier`, `status`; 20260226: `subscription_status`, `team_status`, `head_coach_user_id`, `base_ai_credits`, `ai_usage_this_cycle`. Later migrations add `school_id`, `athletic_department_id`, `sport`, `roster_size`, `season`, `created_by`, `notes`. All are additive; ensure RLS and app use the same column set.

- **users:**  
  20260226 adds `ai_credits_remaining`, `ai_tier`, `ai_auto_recharge_enabled`. 20260303 has base user fields. Same “first migration wins” for base table; columns added with `add column if not exists` are fine.

- **billing-state.ts:**  
  Depends on `games` and `seasons`. Until those tables (and any Stripe-related tables) exist in Supabase, billing will fail or need to be stubbed/guarded.

---

## 6. Dead or Legacy Code Related to Prisma

| Location | Type | Recommendation |
|----------|------|----------------|
| `netlify.toml` | Comment: "Ensure Prisma Client is always regenerated…" | Remove or replace with Supabase/Next build note. |
| `.github/workflows/deploy-guard.yml` | "includes Prisma generate via prebuild" | Remove Prisma reference; prebuild is typecheck/verify-env only. |
| `run-server.ps1` | Prisma client generation block | Remove Prisma steps; keep env/typecheck if present. |
| `setup.ps1` | Prisma client generation | Same as above. |
| `start-dev.ps1` | Check for `node_modules/.prisma` | Remove or replace with Supabase/local check. |
| `.gitignore` | `# prisma`, `/prisma/migrations` | Optional: keep for history or remove. |
| `prisma_schema_fix.txt` (repo root) | Prisma schema fix notes | Remove or move to Docs/archive. |
| Docs: `SETUP.md`, `QUICK_START.md`, `README.md`, `DEPLOY_VERIFICATION_CHECKLIST.md`, etc. | References to Prisma, `db:studio`, `db:generate`, schema.prisma | Update to Supabase (client, migrations, Studio equivalent). |
| `undoc/*` (e.g. INVENTORY_PERMISSIONS_AUDIT, SCHEMA_UPDATE_NEEDED, FIX_SCHEMA) | Prisma schema references | Update or archive. |

---

## 7. Migration Checklist – Files to Migrate Next

Prioritized by impact (user-facing features and shared libs).

### Phase 1 – Auth and core team

- [ ] `api/auth/signup/route.ts` – implement with Supabase Auth + `public.users`/`profiles` (or point to signup-secure and deprecate).
- [ ] `app/api/user/password/route.ts` – change password via Supabase Auth.

### Phase 2 – Roster and depth chart

- [ ] `app/api/roster/import/route.ts` – bulk create/update `players` via Supabase.
- [ ] `app/api/roster/[playerId]/image/route.ts` – player image (Supabase Storage or URL on `players`).
- [ ] `app/api/roster/codes/route.ts`, `update/route.ts`, `generate-codes/route.ts` – use `teams` (e.g. `player_code`, `parent_code`).
- [ ] `app/api/roster/depth-chart/route.ts`, `position-labels/route.ts` – implement from Supabase (e.g. `players` + any depth/position table).
- [ ] `lib/utils/data-filters.ts` – `getParentAccessiblePlayerIds`, `buildPlayerFilter` from Supabase (e.g. `players`, `team_members`).
- [ ] `lib/enforcement/depth-chart-permissions.ts` – `validatePlayerInRoster` from Supabase.

### Phase 3 – Documents and calendar

- [ ] `app/api/documents/[documentId]/route.ts` – GET/DELETE from `documents`.
- [ ] `app/api/documents/[documentId]/link/route.ts` – link document to event/entity (define schema if needed).
- [ ] `app/api/events/[eventId]/documents/route.ts` – event–document relation from Supabase.
- [ ] `lib/enforcement/documents-permissions.ts` – all four functions from Supabase (memberships, documents, visibility).
- [ ] `app/api/teams/[teamId]/calendar/settings/route.ts` – calendar settings from Supabase.
- [ ] `app/api/teams/[teamId]/calendar/events/[eventId]/route.ts` – event CRUD on `events`.
- [ ] `app/api/teams/[teamId]/calendar/events/[eventId]/private-notes/route.ts` – add table if needed; implement from Supabase.
- [ ] `lib/utils/calendar-hierarchy.ts` – `getScopedPlayerIds` from Supabase.

### Phase 4 – Inventory

- [ ] `app/api/teams/[teamId]/inventory/[itemId]/route.ts` – full CRUD on `inventory_items`.
- [ ] `app/api/teams/[teamId]/inventory/[itemId]/transactions/route.ts` – add `inventory_transactions` (or equivalent) migration; implement.
- [ ] `lib/enforcement/inventory-permissions.ts` – all three functions from Supabase.

### Phase 5 – Messaging

- [ ] Add migrations: `message_threads`, `messages`, `message_attachments` (or equivalent).
- [ ] `app/api/messages/threads/route.ts`, `threads/[threadId]/route.ts`, `threads/create/route.ts`.
- [ ] `app/api/messages/send/route.ts`, `contacts/route.ts`.
- [ ] `app/api/messages/attachments/route.ts`, `[attachmentId]/route.ts`, `serve/route.ts`.
- [ ] `lib/utils/messaging-utils.ts` – `ensureGeneralChatThread`, `ensureParentPlayerCoachChat` from Supabase.

### Phase 6 – Payments and Stripe

- [ ] Add migrations for payment/collection state (e.g. `collections`, `invoices`, or align with Stripe IDs only).
- [ ] `app/api/collections/route.ts`, `[collectionId]/route.ts`, `invoices`, `close`, `mark-cash`, `pay-card`.
- [ ] `app/api/teams/[teamId]/payments/coach/*` – connect, status, collections, pay, transactions.
- [ ] `app/api/payments/create-checkout/route.ts`, `mark-paid/route.ts`, `export/route.ts`.
- [ ] `app/api/webhooks/stripe/route.ts` – verify signature; update Supabase (and optional `games`/`seasons`) as needed.

### Phase 7 – Plays (playbooks)

- [ ] Add migration: `plays` (and optional relations).
- [ ] `app/api/plays/route.ts`, `app/api/plays/[playId]/route.ts`.

### Phase 8 – Billing and seasons

- [ ] Add migrations: `seasons`, `games` (and any Stripe-related tables used by billing).
- [ ] `lib/billing/billing-state.ts` – ensure `getTeamBillingState`, `updateFirstGameWeekDate` use Supabase only.
- [ ] `app/api/teams/[teamId]/season/route.ts`, `app/api/teams/rollover/route.ts`.

### Phase 9 – AI

- [ ] Define tables: AI usage, proposals, confirmations (or reuse `agent_actions` and extend).
- [ ] `lib/ai/ai-utils.ts` – `getOrCreateAIUsage`, `recordAIUsage`, `getAIUsageStatus`, `isAIEnabled`.
- [ ] `lib/ai/ai-actions.ts` – `executeSafeAction`, `createActionProposal`, `executeConfirmedAction`.
- [ ] `app/api/ai/propose-action/route.ts`, `confirm-action/route.ts`, `chat/route.ts`, `upload/route.ts`, `app/api/ai-assistant/route.ts`.

### Phase 10 – Admin and support

- [ ] `app/api/admin/teams/[teamId]/route.ts`, `service-status/route.ts`, `ai/route.ts`.
- [ ] `app/api/admin/announcements/route.ts`.
- [ ] `app/api/admin/users/[userId]/password/route.ts`, `password-reset/route.ts`, `status/route.ts`.
- [ ] `app/api/admin/users/[userId]/ai-credits/route.ts` (and any related `users` columns).
- [ ] `app/api/admin/support/tickets/route.ts`, `[ticketId]/route.ts`, `[ticketId]/messages/route.ts`.
- [ ] Replace placeholder admin pages (Section 3.2) with real UI backed by above APIs.

### Phase 11 – Remaining app and compliance

- [ ] `app/api/teams/[teamId]/route.ts` – team CRUD from Supabase.
- [ ] `app/api/teams/[teamId]/summary/route.ts`, `updates/route.ts`.
- [ ] `app/api/teams/[teamId]/memberships/[membershipId]/route.ts` – use `team_members`.
- [ ] `app/api/announcements/route.ts` – use `announcements`.
- [ ] `app/api/compliance/logs/route.ts`, `minor-consent/verify/route.ts` – use `compliance_log` and any new fields.
- [ ] `app/api/invites/bulk/route.ts`, `[id]/resend/route.ts` – use `invites` and audit.
- [ ] `app/api/notifications/preferences/route.ts` – use `notifications` or a preferences table.

---

## 8. Summary

| Category | Count |
|----------|--------|
| API routes returning 501 (Prisma stubbed) | **58** |
| Lib functions that throw (Prisma removed) | **14** (in 8 files) |
| Components/pages that call stubbed APIs or show placeholder | **30+** |
| Admin pages with “temporarily unavailable” message | **8** |
| DB tables referenced in code but not in Supabase migrations | **games, seasons, collections (payments), message_threads/messages/attachments, plays, event_private_notes?, inventory_transactions?, AI usage/proposals** |
| Dead/legacy Prisma references (scripts, docs, config) | **~15** |

No Prisma client or imports remain. The main work is implementing the stubbed routes and lib functions with Supabase and adding the missing tables/migrations above. Use the phase checklist to migrate in order of business priority.
