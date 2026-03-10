# Supabase Migration Refinement & Clarity

## Summary
This commit includes fixes and improvements to Supabase migrations for better clarity, error handling, and maintainability.

## Key Changes

### 1. Fixed Ambiguous Column References in RLS Policies
**File:** `supabase/migrations/20260311000000_rls_policies_migrated_tables.sql`

- **Line 132:** Fixed ambiguous `id` reference in `message_threads_team_member_read` policy
  - Changed: `and public.is_thread_participant(id)`
  - To: `and public.is_thread_participant(message_threads.id)`

- **Line 552:** Fixed ambiguous `id` reference in `guardians_team_coach_read` policy
  - Changed: `where gl.guardian_id = id`
  - To: `where gl.guardian_id = guardians.id`

- **Line 683:** Fixed ambiguous `id` reference in `players_team_member_read` policy
  - Changed: `or public.can_access_player(id)`
  - To: `or public.can_access_player(players.id)`

### 2. Added Conditional Table Existence Checks
**File:** `supabase/migrations/20260312000000_rls_policies_inventory_players_documents.sql`

- Wrapped `documents` table policies in `DO $$` block with existence check
- Wrapped `document_acknowledgements` table policies in `DO $$` block with existence check
- Prevents errors when tables don't exist yet (e.g., if partner's migration hasn't run)

### 3. Made Triggers Idempotent
**Files:**
- `supabase/migrations/20260310000000_messaging_system.sql`
- `supabase/migrations/20260310030000_payments_collections.sql`
- `supabase/migrations/20260314000000_player_injuries_health.sql`

- Added `DROP TRIGGER IF EXISTS` before all `CREATE TRIGGER` statements
- Allows migrations to be safely re-run without errors

### 4. Added Migration Organization Guide
**File:** `SUPABASE_MIGRATION_ORDER.md` (new)

- Clear categorization of migration files
- Labeling system for Supabase SQL Editor (`[PARTNER]`, `[MIGRATION]`, `[RLS]`, `[QUERY]`)
- Guidance on what to keep vs. remove in Supabase
- Quick reference for all 24 migration files

## Migration Files Updated

1. `20260310000000_messaging_system.sql` - Added DROP TRIGGER IF EXISTS
2. `20260310030000_payments_collections.sql` - Added DROP TRIGGER IF EXISTS
3. `20260311000000_rls_policies_migrated_tables.sql` - Fixed 3 ambiguous column references
4. `20260312000000_rls_policies_inventory_players_documents.sql` - Added conditional table checks
5. `20260314000000_player_injuries_health.sql` - Added DROP TRIGGER IF EXISTS

## Benefits

- **Error Prevention:** Ambiguous column references now explicitly qualified
- **Idempotency:** Migrations can be safely re-run
- **Flexibility:** Documents policies only created if table exists
- **Clarity:** Clear organization and labeling system for Supabase SQL Editor
- **Maintainability:** Better documentation and structure

## Testing Recommendations

1. Run all migrations in order in Supabase SQL Editor
2. Verify no ambiguous column errors occur
3. Verify triggers can be re-run without errors
4. Verify documents policies are created only if table exists
5. Verify all RLS policies work correctly
