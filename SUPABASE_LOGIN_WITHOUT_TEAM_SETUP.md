# Supabase Integration: Login Without Team Code

## Overview

This document outlines the Supabase changes required to enable all user roles (players, parents, coaches, etc.) to login and access their portal **without requiring a team code**. Users can now sign up and login, then connect to a team later.

## Changes Made in Codebase

### 1. Dashboard Access
- ✅ Removed team requirement check from dashboard page
- ✅ Updated TeamDashboard component to handle users without teams gracefully
- ✅ Users without teams see a welcome screen with option to connect to team

### 2. Authentication Flow
- ✅ Login route already supports users without teams (no changes needed)
- ✅ Signup route already allows optional team code (no changes needed)
- ✅ Session management works for users without teams

## Supabase Migration Required

### Migration File
**File:** `supabase/migrations/20260317000000_allow_users_without_teams.sql`

This migration updates Row Level Security (RLS) policies to allow users to access their own data even when they don't have a team membership.

### What the Migration Does

1. **Players Table**
   - Users can now read/update players linked to their account (`user_id = auth.uid()`) even without team membership
   - Team members can still access all players in their team
   - Parents can still access players linked via guardian relationships

2. **Team Members Table**
   - Users can read their own team memberships (if any exist)
   - Team membership is now **optional** - users can exist without entries in `team_members`

3. **Notifications Table**
   - Users can read their own notifications even without team membership
   - Team members can still read team notifications

4. **Compliance Log**
   - Users can read their own compliance log entries

## How to Apply the Migration

### Option 1: Using Supabase CLI (Recommended)

```bash
# Navigate to your project directory
cd /path/to/your/project

# Apply the migration
supabase migration up

# Or apply a specific migration
supabase db push
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20260317000000_allow_users_without_teams.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute the migration

### Option 3: Using Supabase Migration Tool

If you're using a migration tool or CI/CD pipeline, ensure this migration file is included in your migration sequence.

## Verification Steps

After applying the migration, verify the following:

### 1. Test User Login Without Team
```sql
-- Create a test user (or use existing)
-- Sign up a player without providing a team code
-- Verify they can login and access /dashboard
```

### 2. Verify RLS Policies
```sql
-- Check that players policy allows user_id access
SELECT * FROM pg_policies 
WHERE tablename = 'players' 
AND policyname = 'players_team_member_read';

-- Check that team_members policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'team_members';
```

### 3. Test Player Access
```sql
-- As a player user, verify you can:
-- 1. Read your own player record (if linked via user_id)
-- 2. Update your own player record
-- 3. Access your profile
-- 4. See your notifications
```

## Important Notes

### Team Membership is Optional
- Users can now exist in the system without any `team_members` entries
- The `profiles.team_id` field can be `NULL`
- Users can connect to teams later via the team code flow

### Backward Compatibility
- ✅ Existing users with teams continue to work as before
- ✅ Team-based features still require team membership
- ✅ RLS policies maintain team-based access for team members

### Data Access Patterns

**Users WITH teams:**
- Can access all team data (roster, schedule, messages, etc.)
- Can access their own personal data
- Subject to role-based permissions

**Users WITHOUT teams:**
- Can access their own personal data (profile, linked player record, notifications)
- Cannot access team-specific data until they join a team
- Can see welcome screen with option to connect to team

## Troubleshooting

### Issue: Users still can't access their data
**Solution:** Verify the migration ran successfully and RLS policies are active:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('players', 'team_members', 'notifications');

-- Should return rowsecurity = true
```

### Issue: Migration fails with "policy already exists"
**Solution:** The migration uses `DROP POLICY IF EXISTS`, so this shouldn't happen. If it does, manually drop the policy first:
```sql
DROP POLICY IF EXISTS players_team_member_read ON public.players;
-- Then re-run the migration
```

### Issue: Users can't see their player record
**Solution:** Ensure the player record has `user_id` set to the user's auth.uid():
```sql
-- Check player linkage
SELECT id, first_name, last_name, user_id 
FROM players 
WHERE user_id = auth.uid();
```

## Next Steps

After applying this migration:

1. ✅ **Test login flow** - Verify users can login without team code
2. ✅ **Test dashboard access** - Verify users see welcome screen without team
3. ✅ **Test team connection** - Verify users can connect to team via code
4. ✅ **Test player creation** - Verify coaches can create players, and players can later link their accounts

## Related Files

- `app/(portal)/dashboard/page.tsx` - Dashboard page (team requirement removed)
- `components/portal/team-dashboard.tsx` - Dashboard component (handles no-team state)
- `app/api/auth/login/route.ts` - Login route (already supports no-team)
- `app/api/auth/signup-secure/route.ts` - Signup route (team code optional)

## Support

If you encounter issues:
1. Check Supabase logs for RLS policy violations
2. Verify migration was applied successfully
3. Check that `auth.uid()` is available in your RLS policies
4. Ensure service role key is used for server-side operations (bypasses RLS)
