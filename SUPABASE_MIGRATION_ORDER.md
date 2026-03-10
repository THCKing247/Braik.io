# Supabase Migration Order & Structure Guide

## ✅ Proper Migration Structure

Your migration files are correctly structured! Here's what you should have:

### **Core Foundation (Already Exists - Don't Recreate)**
These were created by your partner and should already exist:
- `20260225_admin_portal.sql` - Base admin tables
- `20260226_super_admin_console.sql` - Admin console
- `20260227_system_config_versioning.sql` - System config
- `20260303000000_profiles_and_auth_sync.sql` - Users, teams, profiles
- `20260308000000_schools_athletic_departments.sql` - Schools/AD
- `20260308100000_ad_teams_and_invites.sql` - AD teams
- `20260308200000_invite_accepted_by.sql` - Invite tracking
- `20260309000000_players_documents_inventory.sql` - Players, docs, inventory
- `20260309100000_players_onboarding_invites.sql` - Player onboarding
- `20260309120000_repair_team_members_from_profiles.sql` - Team members repair

### **New Migrations (Run These in Order)**

#### **1. Feature Tables (Run First)**
```
20260310000000_messaging_system.sql          ✅ Tables + basic RLS
20260310010000_plays_playbooks.sql           ✅ Tables + basic RLS
20260310020000_depth_chart.sql               ✅ Tables + basic RLS
20260310030000_payments_collections.sql      ✅ Tables + basic RLS
20260310040000_seasons_games.sql             ✅ Tables + basic RLS
20260310050000_guardians.sql                 ✅ Tables + basic RLS
20260310060000_teams_additional_fields.sql   ✅ Adds columns to teams
20260310070000_auth_relationships_fix.sql   ✅ Fixes auth relationships
```

#### **2. RLS Policies (Run After Tables)**
```
20260311000000_rls_policies_migrated_tables.sql  ✅ Helper functions + RLS policies
20260312000000_rls_policies_inventory_players_documents.sql  ✅ Additional RLS
```

#### **3. New Features (Run Last)**
```
20260313000000_roster_template.sql          ✅ Roster template column
20260314000000_player_injuries_health.sql   ✅ Injuries + health status
```

## ⚠️ What You Should NOT Have in Supabase

Based on your list, these items are **NOT separate migrations** - they're either:
- **Queries/scripts** (not migrations)
- **Already included** in the migration files above
- **Helper functions** that are part of RLS policies

**Don't create separate entries for:**
- ❌ "Depth Chart Entries Retrieval" - This is just a query, not a migration
- ❌ "Team Members" - Already in `20260225_admin_portal.sql` or `20260309120000_repair_team_members_from_profiles.sql`
- ❌ "Depth Chart Related Tables Helper Functions" - Already in `20260311000000_rls_policies_migrated_tables.sql`
- ❌ "Find user/team-related tables" - This is a query, not a migration
- ❌ "Public Schema Table List" - This is a query, not a migration
- ❌ "Add Team Member" - This is a script, not a migration
- ❌ "Verify User-Team Membership" - This is a query, not a migration
- ❌ "Restore missing team membership records" - Already in `20260309120000_repair_team_members_from_profiles.sql`
- ❌ "Player Onboarding & Invite Management" - Already in `20260309100000_players_onboarding_invites.sql`
- ❌ "Invite Acceptance Auditor" - This is a query/script, not a migration
- ❌ "Athletic Team & Invite Fields" - Already in migration files
- ❌ "Schools and Athletic Departments Access Model" - Already in `20260308000000_schools_athletic_departments.sql`
- ❌ "Promote user to admin" - This is a script, not a migration
- ❌ "Grant Admin Role to User" - This is a script, not a migration
- ❌ "User, Team & App Data Schemas" - Already in migration files
- ❌ "Reset user password with bcrypt" - This is a script, not a migration
- ❌ "Admin Users Retrieval" - This is a query, not a migration
- ❌ "Insert Admin User" - This is a script, not a migration
- ❌ "Admin Users Flag" - Already in migration files
- ❌ "Remove specific users by email" - This is a script, not a migration
- ❌ "Remove specific user accounts" - This is a script, not a migration
- ❌ "List of public tables" - This is a query, not a migration
- ❌ "Untitled query" - This is not a migration

## ✅ What You SHOULD Have

Only the **migration files** listed above. Each migration file should:
1. Create tables/functions/triggers
2. Use `IF NOT EXISTS` or `DROP IF EXISTS` for safety
3. Be run once (Supabase tracks which migrations have run)

## 🔧 Quick Fix SQL

Run this **first** to fix the issues, then continue with migrations:

```sql
-- Fix 1: Fix can_manage_team function (ambiguous column)
create or replace function public.can_manage_team(team_id_param uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.users u on u.id = tm.user_id
    where tm.team_id = team_id_param
      and tm.user_id = auth.uid()
      and tm.active = true
      and (tm.role = 'HEAD_COACH' or lower(u.role) = 'admin')
  );
$$;

-- Fix 2: Drop existing triggers
drop trigger if exists update_message_thread_updated_at_trigger on public.messages;
drop trigger if exists update_invoice_amount_paid_trigger on public.transactions;
drop trigger if exists update_player_health_on_injury_change on public.player_injuries;
drop trigger if exists update_player_health_on_status_change on public.players;

-- Fix 3: Fix players read policy
drop policy if exists players_team_member_read on public.players;
create policy players_team_member_read on public.players
  for select
  using (
    public.is_team_member(team_id)
    or exists (
      select 1
      from public.guardian_links gl
      join public.guardians g on g.id = gl.guardian_id
      where gl.player_id = players.id
        and g.user_id = auth.uid()
    )
  );
```

## 📋 Recommended Approach

1. **Delete** all the query/script entries from your Supabase SQL Editor list (keep only migrations)
2. **Run the Quick Fix SQL** above first
3. **Run migrations in order** using the migration files from your `supabase/migrations/` folder
4. **Don't manually enter** migration content - use the files directly

The migration files are now fixed and ready to use!
