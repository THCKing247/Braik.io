# Prisma to Supabase Migration Audit Report

**Date:** 2025-01-27  
**Status:** Phase 1 - Audit Complete

## Executive Summary

**Key Finding:** Prisma has already been removed from the codebase. No Prisma schema files, Prisma client imports, or Prisma dependencies exist. The migration to Supabase-native database usage is partially complete, with many API routes and utility functions still marked as "Not migrated" and throwing errors.

**Current State:**
- ✅ Prisma dependencies removed from `package.json`
- ✅ No Prisma schema files found
- ✅ No Prisma client imports in codebase
- ✅ Supabase migrations exist and define the database schema
- ⚠️ Many API routes and utility functions still need implementation
- ⚠️ Documentation still references Prisma in some places

---

## 1. Prisma Files and References

### 1.1 Prisma Files Found
**Result:** None found
- No `prisma/schema.prisma` file exists
- No `prisma/migrations/` directory exists
- No Prisma client setup files found

### 1.2 Prisma Dependencies
**Result:** Removed
- `package.json` does not contain `@prisma/client` or `prisma` dependencies
- No Prisma-related npm scripts found

### 1.3 Prisma Code References
**Result:** Only documentation and error stubs
- Documentation files in `undoc/` and `Docs/` reference Prisma (historical)
- Setup scripts (`setup.ps1`, `start-dev.ps1`, `run-server.ps1`) contain comments about Prisma but no actual Prisma commands
- Many files contain error stubs: `throw new Error("Not migrated: Prisma removed. Use Supabase.")`

### 1.4 Prisma Query Patterns
**Result:** None found
- No `.findMany()`, `.findUnique()`, `.create()`, `.update()`, `.delete()`, or `.upsert()` Prisma method calls found
- All database operations use Supabase client methods

---

## 2. Supabase Schema Map

Based on migration files in `supabase/migrations/`, the following tables exist:

### 2.1 Core Tables

#### `public.users`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `email` text UNIQUE NOT NULL
  - `name` text
  - `role` text NOT NULL, default 'user'
  - `status` text NOT NULL, default 'active'
  - `created_at` timestamptz NOT NULL, default now()
  - `last_login_at` timestamptz
  - `ai_credits_remaining` integer, default 0
  - `ai_tier` text, default 'basic'
  - `ai_auto_recharge_enabled` boolean, default false
- **Indexes:** `idx_users_role_status` on (role, status)
- **RLS:** Enabled
- **Foreign Keys:** None (standalone)

#### `public.profiles`
- **Primary Key:** `id` (uuid, references auth.users)
- **Fields:**
  - `id` uuid PK, references auth.users(id) on delete cascade
  - `email` text
  - `full_name` text
  - `role` text NOT NULL, default 'player'
  - `team_id` uuid (references teams.id)
  - `school_id` uuid (references schools.id)
  - `phone` text
  - `sport` text
  - `program_name` text
  - `created_at` timestamptz NOT NULL, default now()
  - `updated_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_profiles_team_id`, `idx_profiles_school_id`
- **RLS:** Enabled
- **Foreign Keys:** `auth.users(id)`, `teams(id)`, `schools(id)`

#### `public.teams`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `name` text NOT NULL
  - `org` text
  - `plan_tier` text, default 'starter'
  - `status` text, default 'active'
  - `head_coach_user_id` uuid (references users.id)
  - `subscription_status` text, default 'active'
  - `team_status` text, default 'active'
  - `base_ai_credits` integer, default 0
  - `ai_usage_this_cycle` integer, default 0
  - `team_id_code` text UNIQUE
  - `player_code` text UNIQUE
  - `parent_code` text UNIQUE
  - `sport` text
  - `roster_size` integer
  - `season` text
  - `created_by` uuid (references auth.users.id)
  - `notes` text
  - `school_id` uuid (references schools.id)
  - `athletic_department_id` uuid (references athletic_departments.id)
  - `created_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_teams_status`, `idx_teams_sport`, `idx_teams_school_id`, `idx_teams_athletic_department_id`
- **RLS:** Enabled
- **Foreign Keys:** `users(id)`, `schools(id)`, `athletic_departments(id)`

#### `public.team_members`
- **Primary Key:** Composite (team_id, user_id)
- **Fields:**
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `user_id` uuid NOT NULL, references users(id) on delete cascade
  - `role` text NOT NULL
  - `active` boolean NOT NULL, default true
  - `created_at` timestamptz NOT NULL, default now()
- **Indexes:** None explicit
- **RLS:** Enabled
- **Foreign Keys:** `teams(id)`, `users(id)`

### 2.2 Admin Portal Tables

#### `public.support_tickets`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `created_by_user_id` uuid NOT NULL, references users(id) on delete cascade
  - `head_coach_user_id` uuid NOT NULL, references users(id) on delete cascade
  - `status` text NOT NULL, default 'new'
  - `category` text
  - `priority` text, default 'normal'
  - `subject` text NOT NULL
  - `original_message` text NOT NULL
  - `assigned_admin_id` uuid, references users(id) on delete set null
  - `created_at` timestamptz NOT NULL, default now()
  - `updated_at` timestamptz NOT NULL, default now()
- **RLS:** Enabled
- **Foreign Keys:** `teams(id)`, `users(id)` (multiple)

#### `public.support_messages`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `ticket_id` uuid NOT NULL, references support_tickets(id) on delete cascade
  - `sender_admin_id` uuid NOT NULL, references users(id) on delete cascade
  - `message` text NOT NULL
  - `created_at` timestamptz NOT NULL, default now()
- **RLS:** Enabled
- **Foreign Keys:** `support_tickets(id)`, `users(id)`

#### `public.announcements`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `created_by_admin_id` uuid NOT NULL, references users(id) on delete cascade
  - `scope` text NOT NULL, default 'all_head_coaches'
  - `team_id` uuid, references teams(id) on delete set null
  - `head_coach_only` boolean NOT NULL, default true
  - `content` text NOT NULL
  - `created_at` timestamptz NOT NULL, default now()
- **RLS:** Enabled
- **Foreign Keys:** `users(id)`, `teams(id)`

#### `public.audit_logs`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `actor_id` uuid NOT NULL, references users(id) on delete cascade
  - `action_type` text NOT NULL (or `action` text NOT NULL in some migrations)
  - `target_type` text
  - `target_id` text
  - `metadata_json` jsonb (or `metadata` jsonb in some migrations)
  - `created_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_audit_logs_actor_created`, `idx_audit_logs_action_created`
- **RLS:** Enabled
- **Foreign Keys:** `users(id)`

#### `public.subscriptions`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `stripe_subscription_id` text UNIQUE
  - `status` text NOT NULL, default 'active'
  - `current_period_end` timestamptz
  - `auto_recharge_enabled` boolean NOT NULL, default false
  - `created_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_subscriptions_team_status`
- **RLS:** Enabled
- **Foreign Keys:** `teams(id)`

#### `public.agent_actions`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `user_id` uuid NOT NULL, references users(id) on delete cascade
  - `action_type` text NOT NULL
  - `executed_at` timestamptz NOT NULL, default now()
  - `undo_available_until` timestamptz
  - `undone` boolean NOT NULL, default false
  - `cost_in_credits` numeric(12,2) NOT NULL, default 0
- **Indexes:** `idx_agent_actions_team_executed`
- **RLS:** Enabled
- **Foreign Keys:** `teams(id)`, `users(id)`

#### `public.admin_config`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `key` text UNIQUE NOT NULL
  - `value_json` jsonb NOT NULL, default '{}'::jsonb
  - `created_at` timestamptz NOT NULL, default now()
  - `updated_at` timestamptz NOT NULL, default now()
- **RLS:** Enabled
- **Foreign Keys:** None

#### `public.system_config`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `key` text NOT NULL
  - `value_json` jsonb NOT NULL, default '{}'::jsonb
  - `version` integer NOT NULL
  - `applied_scope` text NOT NULL, check in ('future_only', 'all', 'selective')
  - `applied_team_ids` uuid[] NULL
  - `applied_at` timestamptz NOT NULL, default now()
  - `applied_by` uuid NOT NULL, references users(id) on delete cascade
- **Indexes:** `idx_system_config_key_version` (unique), `idx_system_config_applied_at`, `idx_system_config_scope`
- **RLS:** Enabled
- **Foreign Keys:** `users(id)`

### 2.3 Portal/App Tables

#### `public.players`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `first_name` text NOT NULL
  - `last_name` text NOT NULL
  - `grade` integer
  - `jersey_number` integer
  - `position_group` text
  - `status` text NOT NULL, default 'active'
  - `notes` text
  - `image_url` text
  - `user_id` uuid, references users(id) on delete set null
  - `created_at` timestamptz NOT NULL, default now()
  - `updated_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_players_team_id`, `idx_players_user_id`
- **RLS:** Enabled (service role policy)
- **Foreign Keys:** `teams(id)`, `users(id)`

#### `public.documents`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `title` text NOT NULL
  - `file_name` text NOT NULL
  - `file_url` text
  - `file_size` bigint
  - `mime_type` text
  - `category` text NOT NULL, default 'other'
  - `folder` text
  - `visibility` text NOT NULL, default 'all'
  - `scoped_unit` text
  - `scoped_position_groups` jsonb
  - `assigned_player_ids` jsonb
  - `created_by` uuid NOT NULL, references users(id) on delete cascade
  - `created_at` timestamptz NOT NULL, default now()
  - `updated_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_documents_team_id`, `idx_documents_created_by`
- **RLS:** Enabled (service role policy)
- **Foreign Keys:** `teams(id)`, `users(id)`

#### `public.document_acknowledgements`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `document_id` uuid NOT NULL, references documents(id) on delete cascade
  - `user_id` uuid NOT NULL, references users(id) on delete cascade
  - `created_at` timestamptz NOT NULL, default now()
- **Unique Constraint:** (document_id, user_id)
- **Indexes:** `idx_document_acknowledgements_document_id`
- **RLS:** Enabled (service role policy)
- **Foreign Keys:** `documents(id)`, `users(id)`

#### `public.inventory_items`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `category` text NOT NULL
  - `name` text NOT NULL
  - `quantity_total` integer NOT NULL, default 0
  - `quantity_available` integer NOT NULL, default 0
  - `condition` text NOT NULL, default 'GOOD'
  - `assigned_to_player_id` uuid, references players(id) on delete set null
  - `notes` text
  - `status` text NOT NULL, default 'AVAILABLE'
  - `created_at` timestamptz NOT NULL, default now()
  - `updated_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_inventory_items_team_id`, `idx_inventory_items_assigned`
- **RLS:** Enabled (service role policy)
- **Foreign Keys:** `teams(id)`, `players(id)`

#### `public.events`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `event_type` text NOT NULL
  - `title` text NOT NULL
  - `description` text
  - `start` timestamptz NOT NULL
  - `end` timestamptz NOT NULL
  - `location` text
  - `visibility` text NOT NULL, default 'TEAM'
  - `created_by` uuid NOT NULL, references users(id) on delete cascade
  - `created_at` timestamptz NOT NULL, default now()
  - `updated_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_events_team_id`, `idx_events_start`
- **RLS:** Enabled
- **Foreign Keys:** `teams(id)`, `users(id)`

#### `public.notifications`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `user_id` uuid NOT NULL, references users(id) on delete cascade
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `type` text NOT NULL
  - `title` text NOT NULL
  - `body` text
  - `link_url` text
  - `link_type` text
  - `link_id` text
  - `metadata` jsonb
  - `read` boolean NOT NULL, default false
  - `read_at` timestamptz
  - `created_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_notifications_user_read`
- **RLS:** Enabled
- **Foreign Keys:** `users(id)`, `teams(id)`

#### `public.invites`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `team_id` uuid NOT NULL, references teams(id) on delete cascade
  - `email` text NOT NULL
  - `role` text NOT NULL
  - `token` text UNIQUE NOT NULL
  - `expires_at` timestamptz NOT NULL
  - `accepted_at` timestamptz
  - `created_by` uuid NOT NULL, references users(id) on delete cascade
  - `school_id` uuid, references schools(id) on delete set null
  - `athletic_department_id` uuid, references athletic_departments(id) on delete set null
  - `invitee_first_name` text
  - `invitee_last_name` text
  - `created_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_invites_token`, `idx_invites_email`, `idx_invites_team_id`, `idx_invites_school_id`
- **RLS:** Enabled
- **Foreign Keys:** `teams(id)`, `users(id)`, `schools(id)`, `athletic_departments(id)`

#### `public.compliance_log`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `user_id` uuid NOT NULL, references users(id) on delete cascade
  - `event_type` text NOT NULL
  - `policy_version` text NOT NULL
  - `timestamp` timestamptz NOT NULL, default now()
  - `ip_address` text
  - `metadata` jsonb
  - `created_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_compliance_log_user_id`, `idx_compliance_log_event_type`
- **RLS:** Enabled
- **Foreign Keys:** `users(id)`

### 2.4 Athletic Department Tables

#### `public.schools`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `name` text NOT NULL
  - `slug` text UNIQUE
  - `city` text
  - `state` text
  - `school_type` text
  - `mascot` text
  - `website` text
  - `conference_district` text
  - `created_by` uuid, references auth.users(id) on delete set null
  - `created_at` timestamptz NOT NULL, default now()
  - `updated_at` timestamptz NOT NULL, default now()
- **Indexes:** `idx_schools_slug`, `idx_schools_created_by`
- **RLS:** Enabled
- **Foreign Keys:** `auth.users(id)`

#### `public.athletic_departments`
- **Primary Key:** `id` (uuid)
- **Fields:**
  - `id` uuid PK, default gen_random_uuid()
  - `school_id` uuid NOT NULL, references schools(id) on delete cascade
  - `athletic_director_user_id` uuid NOT NULL, references auth.users(id) on delete cascade
  - `department_plan_type` text NOT NULL, default 'athletic_department_license'
  - `estimated_team_count` integer
  - `estimated_athlete_count` integer
  - `status` text NOT NULL, default 'active'
  - `created_at` timestamptz NOT NULL, default now()
  - `updated_at` timestamptz NOT NULL, default now()
- **Unique Constraint:** (school_id)
- **Indexes:** `idx_athletic_departments_school`, `idx_athletic_departments_ad_user`
- **RLS:** Enabled
- **Foreign Keys:** `schools(id)`, `auth.users(id)`

### 2.5 Missing Tables (Referenced but Not Found in Migrations)

Based on code references and error stubs, the following tables may be needed but are not yet defined in migrations:

- **Messaging/Threads:** `message_threads`, `messages`, `message_attachments`
- **Plays/Playbooks:** `plays`, `playbooks`, `playbook_files`
- **Depth Chart:** `depth_chart_entries`, `depth_chart_position_labels`
- **Payments/Collections:** `collections`, `invoices`, `transactions`, `memberships`
- **Seasons:** `seasons`
- **Updates/Feed:** `updates`, `reminders`
- **Guardian Links:** `guardian_links`, `guardians`

---

## 3. Feature-to-Model Dependency Map

### 3.1 Fully Migrated Features (Using Supabase)

| Feature | Tables Used | API Routes | Status |
|---------|------------|------------|--------|
| **Roster Management** | `players`, `users`, `teams` | `/api/roster` (GET, POST) | ✅ Migrated |
| **Documents** | `documents`, `document_acknowledgements`, `users` | `/api/documents` (GET) | ✅ Partially Migrated |
| **Inventory** | `inventory_items`, `players` | `/api/teams/[teamId]/inventory` (GET) | ✅ Partially Migrated |
| **Calendar/Events** | `events`, `users` | `/api/teams/[teamId]/calendar/events` (GET) | ✅ Partially Migrated |
| **Notifications** | `notifications`, `users` | `/api/notifications` (GET), `/api/notifications/[id]` (DELETE) | ✅ Partially Migrated |
| **Auth/Signup** | `auth.users`, `profiles`, `users`, `teams`, `invites` | `/api/auth/signup`, `/api/auth/signup-with-invite`, `/api/auth/signup-athletic-director` | ✅ Migrated |
| **Onboarding** | `profiles`, `teams`, `users` | `/api/onboarding` | ✅ Migrated |
| **Admin Portal** | `users`, `teams`, `support_tickets`, `support_messages`, `announcements`, `audit_logs` | `/api/admin/*` | ✅ Partially Migrated |
| **Team Join** | `teams`, `profiles`, `team_members`, `invites` | `/api/team/join` | ✅ Migrated |
| **Invites** | `invites`, `users`, `teams` | `/api/invites/[id]/accept` | ✅ Migrated |

### 3.2 Features Needing Migration (Error Stubs Present)

| Feature | Expected Tables | API Routes | Priority |
|---------|----------------|------------|----------|
| **Messaging** | `message_threads`, `messages`, `message_attachments` | `/api/messages/*` | HIGH |
| **Plays/Playbooks** | `plays`, `playbooks` | `/api/plays/*` | HIGH |
| **Depth Chart** | `depth_chart_entries`, `depth_chart_position_labels` | `/api/roster/depth-chart/*` | MEDIUM |
| **Payments** | `collections`, `invoices`, `transactions`, `memberships` | `/api/payments/*`, `/api/teams/[teamId]/payments/*` | HIGH |
| **Team Management** | `teams`, `seasons` | `/api/teams/[teamId]`, `/api/teams/[teamId]/season`, `/api/teams/rollover` | MEDIUM |
| **Documents (Write)** | `documents` | `/api/documents/[documentId]` (PATCH, DELETE) | MEDIUM |
| **Inventory (Write)** | `inventory_items` | `/api/teams/[teamId]/inventory/[itemId]` (PATCH, DELETE) | MEDIUM |
| **Calendar (Write)** | `events` | `/api/teams/[teamId]/calendar/events/[eventId]` (PATCH, DELETE) | MEDIUM |
| **Roster (Write)** | `players` | `/api/roster/[playerId]/image`, `/api/roster/import`, `/api/roster/generate-codes` | MEDIUM |
| **Announcements** | `announcements` | `/api/announcements` | MEDIUM |
| **Support Tickets** | `support_tickets`, `support_messages` | `/api/support/tickets` | LOW |
| **AI Actions** | `agent_actions` | `/api/ai/*` | MEDIUM |
| **Compliance** | `compliance_log` | `/api/compliance/*` | LOW |
| **Stripe Webhooks** | `subscriptions`, `teams` | `/api/webhooks/stripe` | HIGH |
| **User Profile** | `users`, `profiles` | `/api/user/profile`, `/api/user/password` | MEDIUM |
| **Notifications Preferences** | `notifications` (or separate table) | `/api/notifications/preferences` | LOW |

### 3.3 Utility Functions Needing Migration

| File | Functions | Tables Needed | Priority |
|------|-----------|---------------|----------|
| `lib/utils/messaging-utils.ts` | `ensureGeneralChatThread`, `ensureParentPlayerCoachChat` | `message_threads` | HIGH |
| `lib/utils/data-filters.ts` | Filter utilities | Various | MEDIUM |
| `lib/utils/calendar-hierarchy.ts` | Hierarchy checks | `events`, `teams` | MEDIUM |
| `lib/enforcement/documents-permissions.ts` | Permission checks | `documents`, `users`, `players` | MEDIUM |
| `lib/enforcement/inventory-permissions.ts` | Permission checks | `inventory_items`, `users`, `players` | MEDIUM |
| `lib/enforcement/depth-chart-permissions.ts` | Permission checks | `depth_chart_entries`, `players` | MEDIUM |
| `lib/ai/ai-utils.ts` | AI utilities | Various | MEDIUM |
| `lib/ai/ai-actions.ts` | AI action execution | `agent_actions`, various | MEDIUM |

---

## 4. Migration Risk Areas

### 4.1 High Risk Areas

1. **Messaging System**
   - **Risk:** Complex threading, attachments, and real-time features
   - **Impact:** Core communication feature
   - **Tables Needed:** `message_threads`, `messages`, `message_attachments`, `message_participants`
   - **Considerations:** May need Supabase Realtime subscriptions

2. **Payments/Collections**
   - **Risk:** Financial transactions, Stripe integration
   - **Impact:** Revenue-critical
   - **Tables Needed:** `collections`, `invoices`, `transactions`, `memberships`
   - **Considerations:** Must maintain data integrity, audit trails

3. **Stripe Webhooks**
   - **Risk:** Subscription management, billing state
   - **Impact:** Critical for billing
   - **Tables Needed:** `subscriptions`, `teams`
   - **Considerations:** Idempotency, webhook replay safety

4. **Plays/Playbooks**
   - **Risk:** Complex nested data structures, file storage
   - **Impact:** Core feature for coaches
   - **Tables Needed:** `plays`, `playbooks`, `playbook_files`
   - **Considerations:** JSONB for play data, file storage integration

### 4.2 Medium Risk Areas

1. **Depth Chart**
   - **Risk:** Position hierarchy, player assignments
   - **Impact:** Important for roster management
   - **Tables Needed:** `depth_chart_entries`, `depth_chart_position_labels`
   - **Considerations:** Ordering, position groups

2. **Team Management**
   - **Risk:** Season rollover, team settings
   - **Impact:** Team lifecycle management
   - **Tables Needed:** `seasons` (if separate), `teams` updates
   - **Considerations:** Data migration during rollover

3. **Permission Enforcement**
   - **Risk:** Role-based access control
   - **Impact:** Security and data access
   - **Tables Needed:** All tables with RLS policies
   - **Considerations:** RLS policies must match Prisma-era assumptions

### 4.3 Low Risk Areas

1. **Support Tickets**
   - **Risk:** Admin-only feature
   - **Impact:** Support workflow
   - **Tables:** Already exist in schema

2. **Compliance Logging**
   - **Risk:** Audit trail
   - **Impact:** Compliance requirements
   - **Tables:** Already exist in schema

---

## 5. Prisma-Era Assumptions That May Break

### 5.1 Nested Relation Queries
- **Prisma Pattern:** `prisma.team.findUnique({ include: { players: true, events: true } })`
- **Supabase Pattern:** Multiple queries or joins
- **Risk:** Performance if not optimized
- **Mitigation:** Use Supabase `.select()` with foreign table syntax or batch queries

### 5.2 Implicit Joins
- **Prisma Pattern:** Automatic relation resolution
- **Supabase Pattern:** Explicit joins or separate queries
- **Risk:** Code expecting nested objects may break
- **Mitigation:** Refactor to explicit join patterns or use Supabase PostgREST foreign table syntax

### 5.3 Auth/User Linkage
- **Prisma Pattern:** Custom user model with relations
- **Supabase Pattern:** `auth.users` + `public.profiles` + `public.users`
- **Risk:** Dual user tables (`auth.users` vs `public.users`) may cause confusion
- **Mitigation:** Document which table to use when, establish clear patterns

### 5.4 Server-Only Query Assumptions
- **Prisma Pattern:** All queries server-side
- **Supabase Pattern:** Can use client-side queries with RLS
- **Risk:** Over-fetching or security issues if RLS not properly configured
- **Mitigation:** Review RLS policies, prefer server-side queries for sensitive data

### 5.5 Table/Field Naming
- **Prisma Pattern:** CamelCase model names, camelCase fields
- **Supabase Pattern:** snake_case table names, snake_case fields
- **Risk:** Code expecting camelCase may break
- **Mitigation:** Already handled in migrated code (uses snake_case)

### 5.6 Transaction Handling
- **Prisma Pattern:** `prisma.$transaction([...])`
- **Supabase Pattern:** No native transactions in JS client
- **Risk:** Multi-step operations may not be atomic
- **Mitigation:** Use Postgres functions or Supabase RPC for transactions

### 5.7 Enum Handling
- **Prisma Pattern:** TypeScript enums from schema
- **Supabase Pattern:** Text fields with string literals
- **Risk:** Type safety lost
- **Mitigation:** Define TypeScript enums/constants matching database values

---

## 6. Recommended Migration Order

Based on dependencies and risk assessment:

### Phase 1: Critical Infrastructure (HIGH PRIORITY)
1. **Stripe Webhooks** (`/api/webhooks/stripe`)
   - Dependencies: `subscriptions`, `teams`
   - Risk: Revenue-critical
   - Effort: Medium

2. **Messaging Core** (`/api/messages/*`)
   - Dependencies: `message_threads`, `messages`
   - Risk: Core feature
   - Effort: High (complex)

3. **Payments/Collections** (`/api/payments/*`, `/api/collections/*`)
   - Dependencies: `collections`, `invoices`, `transactions`, `memberships`
   - Risk: Revenue-critical
   - Effort: High

### Phase 2: Core Features (MEDIUM PRIORITY)
4. **Plays/Playbooks** (`/api/plays/*`)
   - Dependencies: `plays`, `playbooks`
   - Risk: Important feature
   - Effort: Medium

5. **Team Management** (`/api/teams/[teamId]`, `/api/teams/rollover`)
   - Dependencies: `teams`, `seasons` (if needed)
   - Risk: Team lifecycle
   - Effort: Low-Medium

6. **Write Operations for Existing Features**
   - Documents: `/api/documents/[documentId]` (PATCH, DELETE)
   - Inventory: `/api/teams/[teamId]/inventory/[itemId]` (PATCH, DELETE)
   - Calendar: `/api/teams/[teamId]/calendar/events/[eventId]` (PATCH, DELETE)
   - Roster: `/api/roster/[playerId]/image`, `/api/roster/import`
   - Effort: Low-Medium each

### Phase 3: Supporting Features (LOWER PRIORITY)
7. **Depth Chart** (`/api/roster/depth-chart/*`)
   - Dependencies: `depth_chart_entries`, `depth_chart_position_labels`
   - Risk: Medium
   - Effort: Medium

8. **Announcements** (`/api/announcements`)
   - Dependencies: `announcements` (table exists)
   - Risk: Low
   - Effort: Low

9. **AI Actions** (`/api/ai/*`)
   - Dependencies: `agent_actions` (table exists)
   - Risk: Medium
   - Effort: Medium

10. **Utility Functions**
    - `lib/utils/messaging-utils.ts`
    - `lib/utils/data-filters.ts`
    - `lib/utils/calendar-hierarchy.ts`
    - `lib/enforcement/*.ts`
    - `lib/ai/*.ts`
    - Effort: Low-Medium each

### Phase 4: Cleanup (LOW PRIORITY)
11. **Support Tickets** (`/api/support/tickets`)
    - Dependencies: Tables exist
    - Risk: Low
    - Effort: Low

12. **Compliance** (`/api/compliance/*`)
    - Dependencies: Tables exist
    - Risk: Low
    - Effort: Low

13. **User Profile** (`/api/user/profile`, `/api/user/password`)
    - Dependencies: `users`, `profiles`
    - Risk: Low
    - Effort: Low

---

## 7. Files Requiring Migration

### 7.1 API Routes (Not Migrated)

**High Priority:**
- `app/api/webhooks/stripe/route.ts`
- `app/api/messages/threads/route.ts`
- `app/api/messages/threads/[threadId]/route.ts`
- `app/api/messages/threads/create/route.ts`
- `app/api/messages/send/route.ts`
- `app/api/messages/contacts/route.ts`
- `app/api/messages/attachments/route.ts`
- `app/api/messages/attachments/[attachmentId]/route.ts`
- `app/api/messages/attachments/serve/route.ts`
- `app/api/payments/create-checkout/route.ts`
- `app/api/payments/mark-paid/route.ts`
- `app/api/payments/export/route.ts`
- `app/api/collections/route.ts`
- `app/api/collections/[collectionId]/route.ts`
- `app/api/collections/[collectionId]/invoices/route.ts`
- `app/api/collections/[collectionId]/close/route.ts`
- `app/api/collections/pay-card/route.ts`
- `app/api/collections/mark-cash/route.ts`
- `app/api/plays/route.ts`
- `app/api/plays/[playId]/route.ts`

**Medium Priority:**
- `app/api/teams/[teamId]/route.ts`
- `app/api/teams/[teamId]/season/route.ts`
- `app/api/teams/rollover/route.ts`
- `app/api/teams/[teamId]/updates/route.ts`
- `app/api/teams/[teamId]/summary/route.ts`
- `app/api/teams/[teamId]/memberships/[membershipId]/route.ts`
- `app/api/teams/[teamId]/payments/coach/*.ts` (multiple files)
- `app/api/teams/[teamId]/inventory/[itemId]/route.ts`
- `app/api/teams/[teamId]/inventory/[itemId]/transactions/route.ts`
- `app/api/teams/[teamId]/calendar/settings/route.ts`
- `app/api/teams/[teamId]/calendar/events/[eventId]/route.ts`
- `app/api/teams/[teamId]/calendar/events/[eventId]/private-notes/route.ts`
- `app/api/roster/depth-chart/route.ts`
- `app/api/roster/depth-chart/position-labels/route.ts`
- `app/api/roster/[playerId]/image/route.ts`
- `app/api/roster/import/route.ts`
- `app/api/roster/generate-codes/route.ts`
- `app/api/roster/codes/route.ts`
- `app/api/roster/codes/update/route.ts`
- `app/api/documents/[documentId]/route.ts`
- `app/api/documents/[documentId]/link/route.ts`
- `app/api/announcements/route.ts`
- `app/api/ai/chat/route.ts`
- `app/api/ai/propose-action/route.ts`
- `app/api/ai/confirm-action/route.ts`
- `app/api/ai/upload/route.ts`
- `app/api/ai-assistant/route.ts`
- `app/api/user/profile/route.ts`
- `app/api/user/password/route.ts`
- `app/api/notifications/preferences/route.ts`

**Low Priority:**
- `app/api/support/tickets/route.ts`
- `app/api/compliance/logs/route.ts`
- `app/api/compliance/minor-consent/verify/route.ts`
- `app/api/invites/[id]/resend/route.ts`
- `app/api/invites/bulk/route.ts`
- `app/api/events/[eventId]/documents/route.ts`

### 7.2 Utility Functions (Not Migrated)

- `lib/utils/messaging-utils.ts` (2 functions)
- `lib/utils/data-filters.ts` (2 functions)
- `lib/utils/calendar-hierarchy.ts` (1 function)
- `lib/enforcement/documents-permissions.ts` (4 functions)
- `lib/enforcement/inventory-permissions.ts` (3 functions)
- `lib/enforcement/depth-chart-permissions.ts` (1 function)
- `lib/ai/ai-utils.ts` (4 functions)
- `lib/ai/ai-actions.ts` (3 functions)

---

## 8. Next Steps

1. **Create Missing Tables**
   - Review code references to determine exact schema for:
     - `message_threads`, `messages`, `message_attachments`
     - `plays`, `playbooks`, `playbook_files`
     - `depth_chart_entries`, `depth_chart_position_labels`
     - `collections`, `invoices`, `transactions`, `memberships`
     - `seasons` (if separate table needed)
     - `updates`, `reminders` (if separate tables)
     - `guardian_links`, `guardians` (if separate tables)

2. **Begin Phase 1 Migration**
   - Start with Stripe webhooks (revenue-critical)
   - Then messaging system (core feature)
   - Then payments/collections (revenue-critical)

3. **Establish Patterns**
   - Document Supabase query patterns for common operations
   - Create utility functions for common queries (nested relations, transactions)
   - Establish RLS policy review process

4. **Testing Strategy**
   - Test each migrated feature thoroughly
   - Verify RLS policies work as expected
   - Test edge cases (deletes, cascades, permissions)

---

## 9. Summary Statistics

- **Prisma Files Found:** 0
- **Prisma Dependencies:** 0
- **Supabase Tables Defined:** 20+
- **API Routes Needing Migration:** ~60
- **Utility Functions Needing Migration:** ~20
- **Migration Completion:** ~30% (read operations mostly done, write operations pending)

---

**End of Audit Report**
