# Supabase Migrations Summary

**Date:** 2025-01-27  
**Purpose:** Complete Prisma-to-Supabase schema migration

## Overview

This document summarizes all Supabase migration files created to replace the Prisma schema. The migrations preserve the existing data model as closely as possible while adapting to Supabase/PostgreSQL conventions.

## Migration Files Created

### Core Infrastructure (Already Existed)
1. **20260225_admin_portal.sql** - Admin portal baseline schema
2. **20260226_super_admin_console.sql** - Super admin console schema
3. **20260227_system_config_versioning.sql** - System config with versioning
4. **20260303000000_profiles_and_auth_sync.sql** - Profiles and auth sync
5. **20260308000000_schools_athletic_departments.sql** - Schools and AD tables
6. **20260308100000_ad_teams_and_invites.sql** - AD teams and invites
7. **20260308200000_invite_accepted_by.sql** - Invite accepted_by field
8. **20260309000000_players_documents_inventory.sql** - Players, documents, inventory
9. **20260309100000_profiles_updated_at.sql** - Profiles updated_at trigger
10. **20260309200000_profiles_role_check.sql** - Profiles role check

### New Migrations Created

11. **20260310000000_messaging_system.sql** - Messaging system tables
12. **20260310010000_plays_playbooks.sql** - Plays and playbooks
13. **20260310020000_depth_chart.sql** - Depth chart tables
14. **20260310030000_payments_collections.sql** - Payments and collections
15. **20260310040000_seasons_games.sql** - Seasons and games
16. **20260310050000_guardians.sql** - Guardians and guardian links
17. **20260310060000_teams_additional_fields.sql** - Additional team fields

## Tables Created

### Messaging System (20260310000000_messaging_system.sql)

#### `message_threads`
- **Purpose:** Conversation containers for team messaging
- **Key Fields:**
  - `id` (uuid, PK)
  - `team_id` (uuid, FK → teams)
  - `title` (text)
  - `thread_type` (text, default 'general')
  - `created_by` (uuid, FK → users)
  - `created_at`, `updated_at` (timestamptz)
- **Indexes:** team_id, created_by, updated_at
- **RLS:** Enabled (service role policy)

#### `message_thread_participants`
- **Purpose:** Many-to-many relationship between threads and users
- **Key Fields:**
  - `thread_id` (uuid, FK → message_threads, PK)
  - `user_id` (uuid, FK → users, PK)
  - `joined_at` (timestamptz)
  - `last_read_at` (timestamptz)
- **Indexes:** thread_id, user_id
- **RLS:** Enabled (service role policy)

#### `messages`
- **Purpose:** Individual messages within threads
- **Key Fields:**
  - `id` (uuid, PK)
  - `thread_id` (uuid, FK → message_threads)
  - `sender_id` (uuid, FK → users)
  - `content` (text)
  - `created_at`, `updated_at` (timestamptz)
- **Indexes:** thread_id, sender_id, created_at
- **RLS:** Enabled (service role policy)
- **Triggers:** Updates `message_threads.updated_at` on insert

#### `message_attachments`
- **Purpose:** File attachments for messages
- **Key Fields:**
  - `id` (uuid, PK)
  - `message_id` (uuid, FK → messages)
  - `thread_id` (uuid, FK → message_threads, denormalized)
  - `team_id` (uuid, FK → teams, denormalized)
  - `file_name`, `file_url`, `file_size`, `mime_type`
  - `uploaded_by` (uuid, FK → users)
  - `created_at` (timestamptz)
- **Indexes:** message_id, thread_id, team_id
- **RLS:** Enabled (service role policy)

### Plays and Playbooks (20260310010000_plays_playbooks.sql)

#### `playbooks`
- **Purpose:** Collections of plays organized by team
- **Key Fields:**
  - `id` (uuid, PK)
  - `team_id` (uuid, FK → teams)
  - `name` (text)
  - `visibility` (text, default 'team')
  - `nodes` (jsonb) - PlaybookNode structure
  - `root_by_side` (jsonb) - Root nodes by side of ball
  - `created_at`, `updated_at` (timestamptz)
- **Indexes:** team_id, visibility
- **RLS:** Enabled (service role policy)

#### `plays`
- **Purpose:** Individual plays that can belong to playbooks
- **Key Fields:**
  - `id` (uuid, PK)
  - `team_id` (uuid, FK → teams)
  - `playbook_id` (uuid, FK → playbooks, nullable)
  - `side` (text) - 'offense', 'defense', 'special_teams'
  - `formation` (text)
  - `subcategory` (text, nullable)
  - `name` (text)
  - `canvas_data` (jsonb) - Play canvas/drawing data
  - `created_at`, `updated_at` (timestamptz)
- **Indexes:** team_id, playbook_id, side
- **RLS:** Enabled (service role policy)

### Depth Chart (20260310020000_depth_chart.sql)

#### `depth_chart_entries`
- **Purpose:** Player assignments to positions with depth ordering
- **Key Fields:**
  - `id` (uuid, PK)
  - `team_id` (uuid, FK → teams)
  - `unit` (text) - 'offense', 'defense', 'special_teams'
  - `position` (text)
  - `string` (integer) - Depth string (1 = starter, 2 = backup, etc.)
  - `player_id` (uuid, FK → players, nullable)
  - `formation` (text, nullable)
  - `special_team_type` (text, nullable)
  - `created_at`, `updated_at` (timestamptz)
- **Unique Constraint:** (team_id, unit, position, string)
- **Indexes:** team_id, player_id, (team_id, unit, position)
- **RLS:** Enabled (service role policy)

#### `depth_chart_position_labels`
- **Purpose:** Custom position labels per team/unit
- **Key Fields:**
  - `id` (uuid, PK)
  - `team_id` (uuid, FK → teams)
  - `unit` (text)
  - `position` (text)
  - `label` (text)
  - `created_at`, `updated_at` (timestamptz)
- **Unique Constraint:** (team_id, unit, position)
- **Indexes:** team_id, (team_id, unit)
- **RLS:** Enabled (service role policy)

### Payments and Collections (20260310030000_payments_collections.sql)

#### `collections`
- **Purpose:** Payment collection campaigns (roster dues or custom)
- **Key Fields:**
  - `id` (uuid, PK)
  - `team_id` (uuid, FK → teams)
  - `collection_type` (text) - 'roster-dues', 'custom'
  - `title` (text)
  - `description` (text, nullable)
  - `amount` (numeric(10,2), default 0)
  - `status` (text, default 'open') - 'open', 'closed'
  - `due_date` (timestamptz, nullable)
  - `created_by` (uuid, FK → users)
  - `created_at`, `updated_at` (timestamptz)
- **Indexes:** team_id, status, collection_type
- **RLS:** Enabled (service role policy)

#### `invoices`
- **Purpose:** Individual payment obligations per player
- **Key Fields:**
  - `id` (uuid, PK)
  - `collection_id` (uuid, FK → collections)
  - `player_id` (uuid, FK → players)
  - `payer_user_id` (uuid, FK → users, nullable)
  - `amount_due` (numeric(10,2))
  - `amount_paid` (numeric(10,2), default 0)
  - `status` (text, default 'pending') - 'pending', 'paid', 'partial', 'overdue'
  - `invoice_id` (text, nullable) - External invoice ID
  - `date` (timestamptz, default now())
  - `paid_at` (timestamptz, nullable)
  - `created_at`, `updated_at` (timestamptz)
- **Indexes:** collection_id, player_id, payer_user_id, status
- **RLS:** Enabled (service role policy)
- **Triggers:** Updates `amount_paid` and `status` when transactions are created/updated

#### `transactions`
- **Purpose:** Payment records (cash, card, etc.)
- **Key Fields:**
  - `id` (uuid, PK)
  - `invoice_id` (uuid, FK → invoices)
  - `collection_id` (uuid, FK → collections)
  - `amount` (numeric(10,2))
  - `payment_method` (text) - 'cash', 'card', 'check', 'other'
  - `payment_type` (text) - 'payment', 'refund', 'adjustment'
  - `processed_by` (uuid, FK → users, nullable)
  - `notes` (text, nullable)
  - `created_at` (timestamptz)
- **Indexes:** invoice_id, collection_id, processed_by
- **RLS:** Enabled (service role policy)

#### `memberships`
- **Purpose:** Team membership records (for payment context, may overlap with team_members)
- **Key Fields:**
  - `id` (uuid, PK)
  - `team_id` (uuid, FK → teams)
  - `user_id` (uuid, FK → users)
  - `role` (text)
  - `position_groups` (jsonb) - Array of position groups for coordinators
  - `permissions` (jsonb) - Permissions object with coordinatorType, etc.
  - `created_at`, `updated_at` (timestamptz)
- **Unique Constraint:** (team_id, user_id)
- **Indexes:** team_id, user_id, role
- **RLS:** Enabled (service role policy)

### Seasons and Games (20260310040000_seasons_games.sql)

#### `seasons`
- **Purpose:** Team seasons with division, conference, and playoff info
- **Key Fields:**
  - `id` (uuid, PK)
  - `team_id` (uuid, FK → teams)
  - `year` (integer)
  - `name` (text, nullable) - e.g., "2024 Fall Season"
  - `division` (text, nullable) - e.g., "5A", "Division I"
  - `conference` (text, nullable) - e.g., "Big 12", "Metro Conference"
  - `playoff_ruleset` (text, nullable) - Playoff qualification rules
  - `created_at`, `updated_at` (timestamptz)
- **Unique Constraint:** (team_id, year)
- **Indexes:** team_id, year
- **RLS:** Enabled (service role policy)

#### `games`
- **Purpose:** Individual games within seasons
- **Key Fields:**
  - `id` (uuid, PK)
  - `season_id` (uuid, FK → seasons)
  - `team_id` (uuid, FK → teams)
  - `opponent` (text, nullable)
  - `game_date` (timestamptz)
  - `location` (text, nullable)
  - `game_type` (text, nullable) - 'regular', 'playoff', 'scrimmage', 'tournament'
  - `conference_game` (boolean, default false)
  - `result` (text, nullable) - 'win', 'loss', 'tie', null if not played
  - `team_score` (integer, nullable)
  - `opponent_score` (integer, nullable)
  - `confirmed_by_coach` (boolean, default false)
  - `confirmed_at` (timestamptz, nullable)
  - `notes` (text, nullable)
  - `created_at`, `updated_at` (timestamptz)
- **Indexes:** season_id, team_id, game_date, (confirmed_by_coach, result)
- **RLS:** Enabled (service role policy)

### Guardians (20260310050000_guardians.sql)

#### `guardians`
- **Purpose:** Parent/guardian user accounts
- **Key Fields:**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK → users, unique)
  - `first_name`, `last_name` (text, nullable)
  - `phone`, `email` (text, nullable)
  - `relationship` (text, nullable) - 'parent', 'guardian', 'other'
  - `created_at`, `updated_at` (timestamptz)
- **Indexes:** user_id
- **RLS:** Enabled (service role policy)

#### `guardian_links`
- **Purpose:** Many-to-many relationship between guardians and players
- **Key Fields:**
  - `id` (uuid, PK)
  - `guardian_id` (uuid, FK → guardians)
  - `player_id` (uuid, FK → players)
  - `relationship` (text, nullable) - 'parent', 'guardian', 'other'
  - `verified` (boolean, default false)
  - `created_at`, `updated_at` (timestamptz)
- **Unique Constraint:** (guardian_id, player_id)
- **Indexes:** guardian_id, player_id
- **RLS:** Enabled (service role policy)

### Additional Team Fields (20260310060000_teams_additional_fields.sql)

Added to existing `teams` table:
- `slogan` (text, nullable)
- `logo_url` (text, nullable)
- `season_name` (text, nullable)
- `dues_amount` (numeric(10,2), nullable)
- `dues_due_date` (timestamptz, nullable)
- `service_status` (text, default 'ACTIVE') - For team suspension checks

## Schema Differences from Prisma

### Naming Conventions
- **Prisma:** CamelCase model names (e.g., `MessageThread`)
- **Supabase:** snake_case table names (e.g., `message_threads`)
- **Impact:** Code must use snake_case when querying Supabase

### ID Generation
- **Prisma:** `@default(cuid())` or `@default(uuid())`
- **Supabase:** `gen_random_uuid()` for UUIDs
- **Impact:** IDs are still UUIDs, compatible

### Timestamps
- **Prisma:** `@default(now())` and `@updatedAt`
- **Supabase:** `default now()` and triggers for `updated_at`
- **Impact:** Behavior preserved, some tables have manual `updated_at` triggers

### Relations
- **Prisma:** Implicit relations via `@relation`
- **Supabase:** Explicit foreign keys
- **Impact:** Code must explicitly join or query related tables

### Enums
- **Prisma:** TypeScript enums from schema
- **Supabase:** Text fields with string literals
- **Impact:** Type safety lost, must define TypeScript enums/constants manually

### JSON Fields
- **Prisma:** `Json` or `Json?` types
- **Supabase:** `jsonb` type
- **Impact:** Compatible, jsonb is more efficient

### Denormalized Fields
- **Message Attachments:** `thread_id` and `team_id` are denormalized for efficient access checks
- **Impact:** Improves query performance, requires careful updates

## Database Functions and Triggers

### Functions Created

1. **`update_message_thread_updated_at()`**
   - Updates `message_threads.updated_at` when a message is inserted
   - Trigger: `update_message_thread_updated_at_trigger`

2. **`update_invoice_amount_paid()`**
   - Updates `invoices.amount_paid` and `status` when transactions are created/updated
   - Trigger: `update_invoice_amount_paid_trigger`

### Existing Functions (from previous migrations)

- `is_admin()` - Checks if current user is admin
- `is_super_admin()` - Checks if current user is super admin

## Row Level Security (RLS)

All new tables have RLS enabled with service role policies. This allows:
- Server-side API routes to access all data (using service role)
- Future client-side queries with proper RLS policies
- Security at the database level

**Note:** Most tables currently use service role policies (`using (true) with check (true)`). More restrictive policies can be added later based on access patterns.

## Manual Steps Required

### 1. Run Migrations
```bash
# If using Supabase CLI
supabase migration up

# Or apply migrations manually in Supabase dashboard
```

### 2. Verify Tables Created
Check that all tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### 3. Verify Indexes
Check that indexes are created:
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

### 4. Verify Triggers
Check that triggers are active:
```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
```

### 5. Test RLS Policies
Verify RLS policies are working:
```sql
-- Test service role access
SET ROLE service_role;
SELECT COUNT(*) FROM public.message_threads;
RESET ROLE;
```

## Migration Order

Migrations should be applied in chronological order:
1. Existing migrations (20260225 - 202603092)
2. New migrations (20260310000000 - 20260310060000)

The timestamp-based naming ensures proper ordering.

## Compatibility Notes

### Code Compatibility
- All new tables follow existing patterns (snake_case, UUIDs, timestamptz)
- RLS policies allow service role access (matches current API pattern)
- Foreign keys use `on delete cascade` or `on delete set null` as appropriate

### Data Migration
- No data migration needed (new tables, no existing data)
- Existing tables remain unchanged (except `teams` additions)

### API Compatibility
- API routes can now be migrated to use these tables
- Existing error stubs can be replaced with Supabase queries

## Next Steps

1. **Apply Migrations:** Run all migration files in Supabase
2. **Verify Schema:** Confirm all tables, indexes, and triggers are created
3. **Update API Routes:** Migrate API routes from error stubs to Supabase queries
4. **Update Utility Functions:** Migrate utility functions to use Supabase
5. **Add RLS Policies:** Add more restrictive RLS policies if needed
6. **Test Features:** Test each feature area (messaging, plays, depth chart, etc.)

## Summary

- **Total New Tables:** 15
- **Total New Migrations:** 7
- **Total Functions:** 2
- **Total Triggers:** 2
- **Schema Compatibility:** High (preserves Prisma-era data model)
- **Migration Risk:** Low (new tables, no data migration needed)

---

**End of Summary**
