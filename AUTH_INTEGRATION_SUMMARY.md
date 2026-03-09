# Supabase Auth Integration Summary

**Date:** 2025-01-27  
**Purpose:** Document authentication-linked data relationships and ensure proper Supabase Auth integration

## Executive Summary

The app uses a three-table pattern for user data:
1. **`auth.users`** (Supabase Auth) - Authentication source of truth
2. **`public.profiles`** - App-specific user data (id = auth.uid())
3. **`public.users`** - Admin portal and FK reference table (id = auth.uid() for auth users)

All authenticated users must have rows in all three tables with matching IDs. Application code ensures this on signup/login.

---

## 1. Auth-Linked Table Relationships

### 1.1 Core User Tables

#### `auth.users` (Supabase Auth Schema)
- **Source of Truth:** Authentication credentials and basic user data
- **Managed By:** Supabase Auth (via `supabase.auth.admin.createUser()` or `signUp()`)
- **Key Fields:**
  - `id` (uuid, PK) - Used as foreign key in profiles and public.users
  - `email` - User email (unique)
  - `user_metadata` (jsonb) - Stores role, fullName, etc. (legacy, profiles is source of truth)
- **Access:** Via Supabase Auth API only (service role for admin operations)

#### `public.profiles`
- **Purpose:** App-specific user profile data
- **Relationship:** `id` = `auth.users.id` (FK: `auth.users(id) on delete cascade`)
- **Key Fields:**
  - `id` (uuid, PK) - **MUST equal auth.uid()**
  - `email` - Denormalized from auth.users
  - `full_name` - User display name
  - `role` - App role (head_coach, player, parent, etc.)
  - `team_id` - Primary team association
  - `school_id` - Athletic director school association
- **Created:** On signup via `profiles.upsert({ id: authUser.id, ... })`
- **RLS:** Users can read/update own profile; service role has full access

#### `public.users`
- **Purpose:** Admin portal and FK reference table
- **Relationship:** `id` = `auth.uid()` for authenticated users (application-enforced)
- **Key Fields:**
  - `id` (uuid, PK) - **MUST equal auth.uid() for auth users**
  - `email` - Denormalized from auth.users
  - `name` - User display name
  - `role` - Admin role (head_coach, athlete, admin, etc.) - different from profiles.role
  - `status` - Account status (active, suspended, etc.)
- **Created:** On signup/login via `users.upsert({ id: authUser.id, ... })`
- **Used By:**
  - `team_members.user_id` (FK reference)
  - Admin portal role checks
  - Support tickets, audit logs
- **RLS:** Admin policies; service role has full access

### 1.2 Team Membership

#### `public.team_members`
- **Purpose:** Many-to-many relationship between users and teams
- **Relationship:** `user_id` references `public.users(id)` where `id = auth.uid()`
- **Key Fields:**
  - `team_id` (uuid, FK → teams)
  - `user_id` (uuid, FK → users) - **Must equal auth.uid()**
  - `role` - Team role (HEAD_COACH, ASSISTANT_COACH, PLAYER, PARENT)
  - `active` - Membership status
- **Created:** On signup (if team provided) or team join
- **Critical:** `public.users` row must exist BEFORE `team_members` insert (FK constraint)

### 1.3 Other Auth-Linked Tables

All tables that reference users use one of these patterns:

**Pattern A: Direct auth.uid() reference (via profiles.id)**
- `profiles` - `id` = auth.uid()
- `guardians` - `user_id` = auth.uid() (via profiles)
- `athletic_departments` - `athletic_director_user_id` = auth.uid()

**Pattern B: Via public.users (for FK constraints)**
- `team_members` - `user_id` → `public.users(id)` = auth.uid()
- `support_tickets` - `created_by_user_id`, `head_coach_user_id` → `public.users(id)`
- `audit_logs` - `actor_id` → `public.users(id)`
- `events` - `created_by` → `public.users(id)`
- `documents` - `created_by` → `public.users(id)`
- `notifications` - `user_id` → `public.users(id)`
- `compliance_log` - `user_id` → `public.users(id)`

**Pattern C: Direct auth.users reference (where allowed)**
- `teams` - `created_by` → `auth.users(id)` (nullable)
- `schools` - `created_by` → `auth.users(id)` (nullable)
- `players` - `created_by` → `auth.users(id)` (nullable, for coach-created players)

---

## 2. Code Updated for Supabase Auth Integration

### 2.1 Signup Flows

#### `app/api/auth/signup/route.ts`
**Pattern:**
1. Create `auth.users` via `supabase.auth.admin.createUser()`
2. Upsert `profiles` with `id = authUser.id`
3. Upsert `public.users` with `id = authUser.id` (before team_members)
4. Insert `team_members` with `user_id = authUser.id` (if team provided)

**Status:** ✅ Migrated

#### `app/api/auth/signup-secure/route.ts`
**Pattern:** Same as above, with additional error handling and rollback
**Status:** ✅ Migrated

#### `app/api/auth/signup-with-invite/route.ts`
**Pattern:**
1. Create `auth.users` via `supabase.auth.admin.createUser()`
2. Call `acceptInvite()` which:
   - Upserts `profiles`
   - Upserts `public.users`
   - Inserts `team_members`
   - Updates `invites.accepted_at`

**Status:** ✅ Migrated

#### `app/api/auth/signup-athletic-director/route.ts`
**Pattern:** Similar to signup-secure, creates AD-specific records
**Status:** ✅ Migrated

### 2.2 Login Flow

#### `app/api/auth/login/route.ts`
**Pattern:**
1. Authenticate via `supabase.auth.signInWithPassword()`
2. Load/upsert `profiles` (fallback to user_metadata if missing)
3. Upsert `public.users` (best-effort, for admin checks)
4. Set session cookies

**Status:** ✅ Migrated

### 2.3 Session Management

#### `lib/auth/server-auth.ts`
**Pattern:**
1. Get access token from `sb-access-token` cookie
2. Verify via `supabase.auth.getUser(accessToken)`
3. Load `profiles` for app role
4. Load `public.users` for admin role (optional)

**Status:** ✅ Migrated

### 2.4 Team Join

#### `app/api/team/join/route.ts`
**Pattern:**
1. Validate invite code
2. Update `profiles.team_id`
3. Upsert `team_members` (requires `public.users` row exists)

**Status:** ✅ Migrated (uses partner's invite code fields)

### 2.5 Invite Acceptance

#### `lib/invites/accept-invite.ts`
**Pattern:**
1. Validate email match
2. Insert `team_members`
3. Upsert `profiles`
4. Upsert `public.users`
5. Update `invites.accepted_at`

**Status:** ✅ Migrated

---

## 3. Assumptions About User/Profile/Team Relationships

### 3.1 ID Alignment Assumption
**Assumption:** `profiles.id = public.users.id = auth.uid()` for all authenticated users

**Enforcement:**
- ✅ Enforced by application code on signup/login
- ✅ `profiles.id` has FK constraint to `auth.users(id)`
- ⚠️ `public.users.id` has no FK constraint (PostgreSQL limitation)
- ✅ Partner's repair script (`20260309120000_repair_team_members_from_profiles.sql`) fixes existing data

**Risk:** If application code fails to upsert `public.users`, `team_members` inserts will fail (FK violation). This is handled with try/catch in most places.

### 3.2 Role Mapping Assumption
**Assumption:** Two role systems exist:
- `profiles.role` - App role (head_coach, player, parent, etc.)
- `public.users.role` - Admin role (head_coach, athlete, admin, etc.)

**Mapping:** `lib/auth/user-roles.ts` provides `profileRoleToUserRole()` function

**Risk:** Role mismatch if mapping function is incorrect. Currently handles: player → athlete, others map 1:1.

### 3.3 Team Membership Assumption
**Assumption:** User can have `profiles.team_id` set without `team_members` row (legacy data)

**Handling:**
- ✅ Partner's repair script fixes this
- ✅ Application code creates both on signup
- ⚠️ `team/join` route only updates `profiles.team_id` - relies on repair script or separate team_members insert

**Risk:** If user has `profiles.team_id` but no `team_members` row, RBAC checks will fail. Repair script addresses this.

### 3.4 Service Role Usage Assumption
**Assumption:** Service role is used for:
- Auth operations (createUser, deleteUser)
- Server-side queries that need to bypass RLS
- Admin operations

**Enforcement:**
- ✅ Service role key only in server environment variables
- ✅ Never exposed to client
- ✅ Used via `getSupabaseServer()` or `getSupabaseAdminClient()`

**Risk:** Low - service role is properly scoped to server-side code.

---

## 4. Remaining Auth Risks

### 4.1 High Risk

**None identified** - Core auth flows are migrated and working.

### 4.2 Medium Risk

#### 4.2.1 Dual User Tables Confusion
**Risk:** Developers may query `public.users` when they should query `profiles` or vice versa.

**Mitigation:**
- ✅ Clear documentation (this document)
- ✅ Consistent patterns in codebase
- ✅ Comments in migration files

**Recommendation:** Consider consolidating to single user table in future, but current pattern works.

#### 4.2.2 Missing public.users Row
**Risk:** If `public.users` upsert fails silently, `team_members` inserts will fail.

**Current Handling:**
- ✅ Most signup flows upsert `public.users` before `team_members`
- ⚠️ Some flows use try/catch and continue (non-fatal)
- ✅ Partner's repair script fixes existing data

**Recommendation:** Make `public.users` upsert required (not best-effort) in all signup flows.

#### 4.2.3 Role Mismatch
**Risk:** `profiles.role` and `public.users.role` can get out of sync.

**Current Handling:**
- ✅ Both updated on signup/login
- ⚠️ Profile updates don't always update `public.users.role`

**Recommendation:** Add helper function to sync roles, or make profile updates also update `public.users`.

### 4.3 Low Risk

#### 4.3.1 Legacy Data
**Risk:** Old data may not follow new patterns.

**Mitigation:**
- ✅ Partner's repair script fixes `team_members` from `profiles`
- ✅ Login flow upserts missing profiles/users

#### 4.3.2 Auth User Deletion
**Risk:** If `auth.users` is deleted, cascades should clean up related data.

**Current Handling:**
- ✅ `profiles` has `on delete cascade` from `auth.users`
- ⚠️ `public.users` has no FK, so manual cleanup needed
- ✅ `team_members` has `on delete cascade` from `public.users`

**Recommendation:** Add cleanup function or trigger to remove `public.users` when `auth.users` is deleted (via webhook).

---

## 5. Migration Files Related to Auth

### 5.1 Existing Migrations

1. **20260225_admin_portal.sql** - Creates `public.users` and `team_members`
2. **20260303000000_profiles_and_auth_sync.sql** - Creates `profiles` with FK to `auth.users`
3. **20260309100000_players_onboarding_invites.sql** - Adds invite code fields (partner)
4. **20260309120000_repair_team_members_from_profiles.sql** - One-time repair script (partner)
5. **20260310070000_auth_relationships_fix.sql** - Documentation and comments (this work)

### 5.2 Recommended Additional Migrations

**None required** - Current migrations are sufficient. Application code handles the relationships.

---

## 6. Service Role Usage

### 6.1 Where Service Role is Used

**Auth Operations:**
- `app/api/auth/signup*` - Create auth users
- `app/api/auth/signup-with-invite` - Create auth users
- `app/api/auth/signup-athletic-director` - Create auth users
- `lib/invites/accept-invite.ts` - Upsert profiles/users

**Server-Side Queries:**
- `lib/auth/server-auth.ts` - Get user session
- `lib/auth/rbac.ts` - Check team membership
- All API routes that query database

**Admin Operations:**
- Admin portal routes
- User management
- Team management

### 6.2 Service Role Security

**✅ Secure:**
- Service role key only in server environment variables
- Never exposed to client-side code
- Used via `getSupabaseServer()` which uses `SUPABASE_SERVICE_ROLE_KEY`

**✅ RLS Policies:**
- Most tables have service role policies (`using (true) with check (true)`)
- Allows server-side code to bypass RLS
- Client-side code (if any) would use anon key and respect RLS

**⚠️ Future Consideration:**
- Consider more restrictive RLS policies for client-side queries
- Service role should remain for server-side operations only

---

## 7. Recommended Next Steps

### 7.1 Immediate (High Priority)

1. **Review and Test Auth Flows**
   - Test all signup paths (head coach, player, parent, AD)
   - Test login flow
   - Test team join flow
   - Verify `public.users` rows are created

2. **Run Partner's Repair Script**
   - Execute `20260309120000_repair_team_members_from_profiles.sql`
   - Verify all users with `profiles.team_id` have `team_members` rows

3. **Add Monitoring**
   - Log when `public.users` upsert fails
   - Alert on missing `team_members` rows for users with `profiles.team_id`

### 7.2 Short Term (Medium Priority)

1. **Standardize public.users Upsert**
   - Make `public.users` upsert required (not best-effort) in all signup flows
   - Add error handling if upsert fails

2. **Add Role Sync Helper**
   - Create function to sync `profiles.role` → `public.users.role`
   - Call on profile updates

3. **Document Patterns**
   - Add code comments referencing this document
   - Create helper functions for common patterns

### 7.3 Long Term (Low Priority)

1. **Consider Consolidation**
   - Evaluate merging `profiles` and `public.users` (breaking change)
   - Or create view that joins both

2. **Add Webhook for Auth Events**
   - Sync `public.users` on `auth.users` create/update/delete
   - Ensure data consistency

3. **Add Tests**
   - Unit tests for auth flows
   - Integration tests for signup/login
   - Test role mapping functions

---

## 8. Summary

### 8.1 Current State

**✅ Working:**
- All signup flows create/update auth.users, profiles, and public.users
- Login flow syncs profiles and public.users
- Team membership works via team_members table
- Service role is properly scoped to server-side code

**⚠️ Needs Attention:**
- Some flows treat `public.users` upsert as best-effort (should be required)
- Role sync between profiles and public.users could be improved
- Legacy data may need repair script run

**✅ Mitigated:**
- Partner's repair script fixes existing data
- Login flow creates missing profiles/users
- Documentation clarifies relationships

### 8.2 Auth Table Relationships Summary

```
auth.users (Supabase Auth)
  ↓ (id = auth.uid())
public.profiles (app data)
  ↓ (team_id)
public.teams

auth.users (Supabase Auth)
  ↓ (id = auth.uid())
public.users (admin/FK reference)
  ↓ (id = user_id)
public.team_members
  ↓ (team_id)
public.teams
```

**Key Point:** `profiles.id = public.users.id = auth.uid()` for all authenticated users. Application code ensures this on signup/login.

---

**End of Summary**
