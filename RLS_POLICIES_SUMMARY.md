# Row Level Security (RLS) Policies Summary

**Date:** 2025-01-27  
**Migration:** `20260311000000_rls_policies_migrated_tables.sql`

## Overview

This document summarizes the Row Level Security (RLS) policies implemented for the migrated Supabase tables. These policies enforce team-based access control and role-based permissions, replacing the permissive service_role-only policies with proper access control.

---

## Helper Functions

The migration creates several helper functions for policy checks:

### `public.is_team_member(team_id_param uuid)`
- Returns `true` if the current user (`auth.uid()`) is an active member of the specified team
- Used for basic team membership checks

### `public.get_team_role(team_id_param uuid)`
- Returns the user's role in the specified team (HEAD_COACH, ASSISTANT_COACH, PLAYER, PARENT, etc.)
- Used for role-based access decisions

### `public.can_edit_roster(team_id_param uuid)`
- Returns `true` if the user is a HEAD_COACH or ASSISTANT_COACH in the team
- Used for roster editing permissions

### `public.can_manage_team(team_id_param uuid)`
- Returns `true` if the user is HEAD_COACH or has admin role
- Used for team management operations

### `public.is_thread_participant(thread_id_param uuid)`
- Returns `true` if the user is a participant in the specified message thread
- Used for messaging access control

### `public.can_access_player(player_id_param uuid)`
- Returns `true` if:
  - User is the player themselves, OR
  - User is a guardian linked to the player, OR
  - User is a team member of the player's team
- Used for player data access (supports parent access via guardian links)

---

## Table Policies

### Messaging System

#### `message_threads`
- **Read:** Team members who are participants in the thread
- **Insert:** Team members can create threads for their team
- **Update:** Thread creator or head coach
- **Delete:** Head coach or admin only
- **Service Role:** Full access (for server-side operations)

#### `message_thread_participants`
- **Read:** Team members can see participants in threads they're in
- **Insert:** Team members can add participants to threads in their team
- **Update:** Head coach only
- **Delete:** Head coach or thread creator
- **Service Role:** Full access

#### `messages`
- **Read:** Thread participants can read messages
- **Insert:** Thread participants can send messages (must be sender)
- **Update:** Message sender can update their own messages
- **Delete:** Message sender or head coach
- **Service Role:** Full access

#### `message_attachments`
- **Read:** Thread participants can read attachments
- **Insert:** Thread participants can upload attachments
- **Update:** Uploader or head coach
- **Delete:** Uploader or head coach
- **Service Role:** Full access

**Access Pattern:** Thread-based access control. Users must be participants in a thread to access its messages and attachments.

---

### Plays and Playbooks

#### `plays`
- **Read:** All team members
- **Insert:** Coaches (HEAD_COACH or ASSISTANT_COACH)
- **Update:** Coaches
- **Delete:** Coaches
- **Service Role:** Full access

#### `playbooks`
- **Read:** All team members
- **Insert:** Coaches
- **Update:** Coaches
- **Delete:** Coaches
- **Service Role:** Full access

**Access Pattern:** Team-based with role restrictions. All team members can view, but only coaches can modify.

---

### Depth Chart

#### `depth_chart_entries`
- **Read:** All team members
- **Insert:** Coaches
- **Update:** Coaches
- **Delete:** Coaches
- **Service Role:** Full access

#### `depth_chart_position_labels`
- **Read:** All team members
- **Insert:** Coaches
- **Update:** Coaches
- **Delete:** Coaches
- **Service Role:** Full access

**Access Pattern:** Team-based with role restrictions. All team members can view, but only coaches can modify.

---

### Guardians

#### `guardians`
- **Read:** 
  - Users can read their own guardian record
  - Team coaches can read guardians linked to their team's players
- **Insert:** Users can create their own guardian record
- **Update:** Users can update their own guardian record
- **Delete:** Users can delete their own guardian record
- **Service Role:** Full access

#### `guardian_links`
- **Read:**
  - Guardians can read their own links
  - Coaches can read links for their team's players
- **Insert:**
  - Guardians can create links to players (with verification)
  - Coaches can create links for their team
- **Update:** Coaches only (e.g., verify links)
- **Delete:**
  - Guardians can delete their own links
  - Coaches can delete any link for their team
- **Service Role:** Full access

**Access Pattern:** Self-access for guardians, team-based access for coaches. Supports parent-player relationships.

---

### Players

#### `players`
- **Read:**
  - Team members can read players in their team
  - Users can access players via `can_access_player()` (supports guardian links)
- **Insert:** Coaches
- **Update:** Coaches
- **Delete:** Coaches
- **Service Role:** Full access (existing policy from earlier migration)

**Access Pattern:** Team-based with role restrictions. More granular filtering (e.g., assistant coach position groups, parent access) is handled in application code via `lib/utils/data-filters.ts`.

**Note:** The RLS policy provides base-level access. Application code in `data-filters.ts` provides additional filtering:
- Assistant coaches: Filtered by position groups
- Parents: Filtered by guardian links
- Players: Can only see themselves

---

## Service Role Policies

All tables maintain a service role policy that allows full access:
```sql
create policy {table}_service_role on public.{table}
  for all using (true) with check (true);
```

**Important Notes:**
1. **Service role key bypasses RLS:** When using the service role key (`SUPABASE_SERVICE_ROLE_KEY`), Supabase bypasses RLS entirely. These policies are primarily for documentation and clarity.
2. **Server-side operations:** The service role is used for all server-side API routes, which is appropriate since:
   - Server code already enforces permissions via `requireTeamAccess()` and `requireTeamPermission()`
   - Server code has access to user session and can make informed access decisions
   - RLS would be redundant and could cause issues with complex queries
3. **Client-side operations:** If client-side code uses the anon key, RLS policies will be enforced.

---

## Access Control Layers

The application uses multiple layers of access control:

### 1. Database Layer (RLS Policies)
- **Purpose:** Base-level security, prevents unauthorized direct database access
- **Scope:** Team membership, basic role checks
- **Enforcement:** Automatic when using anon key

### 2. Application Layer (RBAC)
- **Purpose:** Fine-grained permissions, business logic
- **Location:** `lib/auth/rbac.ts`, `lib/auth/roles.ts`
- **Functions:** `requireTeamAccess()`, `requireTeamPermission()`, `canEditRoster()`, etc.
- **Enforcement:** Manual checks in API routes

### 3. Data Filtering Layer
- **Purpose:** Role-specific data filtering (e.g., assistant coach position groups, parent guardian links)
- **Location:** `lib/utils/data-filters.ts`
- **Functions:** `buildPlayerFilter()`, `getParentAccessiblePlayerIds()`
- **Enforcement:** Applied to queries in API routes

---

## Policy Coverage

### Tables with RLS Policies

✅ **Messaging:**
- `message_threads`
- `message_thread_participants`
- `messages`
- `message_attachments`

✅ **Plays:**
- `plays`
- `playbooks`

✅ **Depth Chart:**
- `depth_chart_entries`
- `depth_chart_position_labels`

✅ **Guardians:**
- `guardians`
- `guardian_links`

✅ **Players:**
- `players` (updated policies)

### Tables with Existing RLS (Not Modified)

These tables already have RLS policies from earlier migrations:
- `users` (admin and self-select policies)
- `teams` (admin and member-select policies)
- `team_members` (admin and self-select policies)
- `profiles` (own-all and service role policies)
- `invites` (existing policies)
- `events` (existing policies)
- `notifications` (existing policies)
- `compliance_log` (existing policies)
- `documents` (service role policy)
- `inventory_items` (service role policy)
- `collections`, `invoices`, `transactions`, `memberships` (service role policies)
- `seasons`, `games` (service role policies)
- `schools`, `athletic_departments` (existing policies)

---

## Testing Recommendations

### 1. Team Membership
- Verify users can only access data for teams they're members of
- Verify users cannot access data for teams they're not members of

### 2. Role-Based Permissions
- **Head Coach:** Can manage all team data
- **Assistant Coach:** Can edit roster/plays but not manage team settings
- **Player:** Can read team data but not modify
- **Parent:** Can access their linked players' data

### 3. Messaging
- Verify thread participants can access messages
- Verify non-participants cannot access messages
- Verify head coach can manage threads

### 4. Guardian Links
- Verify parents can access their linked players
- Verify coaches can manage guardian links for their team
- Verify guardians cannot access other guardians' data

### 5. Service Role
- Verify server-side operations work (service role bypasses RLS)
- Verify client-side operations respect RLS (if using anon key)

---

## Security Considerations

### ✅ Strengths
1. **Team-based isolation:** Users can only access data for teams they're members of
2. **Role-based permissions:** Different roles have different access levels
3. **Thread-based messaging:** Messages are isolated by thread participation
4. **Guardian link support:** Parents can access their children's data via verified links
5. **Service role separation:** Server-side operations use service role (bypasses RLS), client-side respects RLS

### ⚠️ Considerations
1. **Service role usage:** All API routes use service role key, so RLS is bypassed. Application-layer permissions are critical.
2. **Complex queries:** Some queries may need to be adjusted if client-side code uses anon key
3. **Performance:** Helper functions are marked `stable` and `security definer` for performance, but complex policies may impact query performance

### 🔒 Best Practices
1. **Always use service role for server-side operations:** This is the current pattern and is appropriate
2. **Enforce permissions in application code:** Don't rely solely on RLS for complex business logic
3. **Test with anon key:** If client-side code uses anon key, test that RLS policies work correctly
4. **Monitor policy performance:** Complex policies with multiple subqueries may need optimization

---

## Migration Notes

### Before Migration
- All tables had permissive `service_role` policies: `using (true) with check (true)`
- No user-level access control at database level
- All access control was in application code only

### After Migration
- Tables have proper RLS policies enforcing team membership and roles
- Service role policies remain for server-side operations
- Helper functions provide reusable access checks
- Application code still enforces permissions (dual-layer security)

### Breaking Changes
- **None for server-side code:** Service role bypasses RLS, so existing API routes continue to work
- **Potential for client-side code:** If any client-side code uses anon key, it will now be subject to RLS policies

---

## Future Enhancements

1. **Client-side RLS testing:** If client-side code is added, test with anon key
2. **Policy optimization:** Monitor query performance and optimize complex policies if needed
3. **Additional tables:** Apply similar patterns to remaining tables (documents, events, etc.)
4. **Audit logging:** Consider adding RLS policy violation logging for security monitoring

---

**End of Summary**
