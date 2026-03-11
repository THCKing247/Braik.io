# Settings Restructure and Coaching Structure Implementation

## Overview

This document outlines the implementation of:
1. Restructured settings page with left sidebar navigation
2. Users list section showing all team members
3. Coaching structure management system

## Changes Made

### 1. Settings Page Restructure

**File:** `app/(portal)/dashboard/settings/page.tsx`
- ✅ Converted to server-side component
- ✅ Fetches user and team data from database
- ✅ Passes data to `SettingsLayout` component
- ✅ Maintains sidebar navigation on the left, content on the right

**File:** `components/portal/settings-layout.tsx`
- ✅ Already had sidebar structure (no changes needed)
- ✅ Added "Users" section to settings menu
- ✅ Only visible to head coaches

### 2. Users List Component

**File:** `components/portal/settings-sections/users-list-settings.tsx`

**Features:**
- ✅ Shows all team users organized by role:
  - **Assistant Coaches** - with coaching structure management
  - **Players** - simple list view
  - **Parents** - shows player relation (e.g., "Parent of John Smith")
- ✅ Expandable cards for assistant coaches
- ✅ Coaching structure management:
  - Coordinator role selection (dropdown)
  - Position coach role selection (toggle buttons)

**Coaching Structure:**
- **Coordinator Roles** (one per team):
  - Offensive Coordinator
  - Defensive Coordinator
  - Special Teams Coordinator (optional)
- **Position Coach Roles** (multiple allowed):
  - **Offense:** OL, WR, QB, RB, TE
  - **Defense:** DB, LB, DL
  - **Special Teams:** Snap, Kick, Punt

### 3. Database Migration

**File:** `supabase/migrations/20260318000000_coaching_structure.sql`

**Changes:**
- ✅ Added `coordinator_role` column to `profiles` table
  - Values: `offensive_coordinator`, `defensive_coordinator`, `special_teams_coordinator`, or `null`
- ✅ Added `position_coach_roles` column to `profiles` table
  - Array of position roles: `['OL', 'WR', 'QB', ...]`
- ✅ Added validation function for position coach roles
- ✅ Added trigger to ensure only one coordinator per role per team
- ✅ Added indexes for efficient lookups

**Constraints:**
- Only one person can hold each coordinator role per team
- Multiple people can hold the same position coach role
- One person can hold multiple position coach roles
- Position coach roles are validated against allowed values

### 4. API Endpoints

**File:** `app/api/teams/[teamId]/users/route.ts`
- **GET** - Returns all users for a team
  - Includes coordinator roles and position coach roles
  - Includes player relations for parents
  - Only accessible to head coaches

**File:** `app/api/teams/[teamId]/users/[userId]/coaching-structure/route.ts`
- **PATCH** - Updates coaching structure for a user
  - Updates coordinator role
  - Updates position coach roles
  - Validates constraints (one coordinator per role)
  - Only accessible to head coaches

## How It Works

### For Head Coaches

1. **Access Users List:**
   - Go to Settings → Users
   - See all team members organized by role

2. **Manage Coaching Structure:**
   - Click on an assistant coach to expand
   - Select coordinator role from dropdown (if available)
   - Toggle position coach roles using buttons
   - Changes save automatically

3. **View Team Members:**
   - See all assistants with their roles
   - See all players
   - See all parents with their player relations

### Coaching Structure Rules

**Coordinator Roles:**
- Only one person can be Offensive Coordinator
- Only one person can be Defensive Coordinator
- Only one person can be Special Teams Coordinator (optional)
- If a coordinator role is assigned, it shows "(Assigned)" for other users

**Position Coach Roles:**
- Multiple people can hold the same position role
- One person can hold multiple position roles
- Roles are organized by category (Offense, Defense, Special Teams)

## Database Schema

### Profiles Table (Updated)

```sql
coordinator_role text check (
  coordinator_role is null or coordinator_role in (
    'offensive_coordinator', 
    'defensive_coordinator', 
    'special_teams_coordinator'
  )
)

position_coach_roles text[] default '{}'
  -- Valid values: OL, WR, QB, RB, TE, DB, LB, DL, Snap, Kick, Punt
```

### Constraints

- **Single Coordinator Per Role:** Enforced by database trigger
- **Valid Position Roles:** Enforced by check constraint
- **Team Scoped:** Coordinator roles are unique per team

## UI Features

### Settings Sidebar
- Left sidebar with all settings sections
- Active section highlighted
- Content panel on the right
- Sidebar remains visible when navigating between sections

### Users List
- **Assistant Coaches:**
  - Expandable cards
  - Coordinator role dropdown
  - Position coach role toggles
  - Visual badges showing current roles

- **Players:**
  - Simple list view
  - Name and email
  - Player badge

- **Parents:**
  - Simple list view
  - Name and email
  - Player relation shown (e.g., "Parent of John Smith")
  - Parent badge

## API Usage

### Get Team Users
```typescript
GET /api/teams/{teamId}/users
Response: {
  users: [
    {
      id: string
      email: string
      name: string | null
      role: string
      coordinatorRole: string | null
      positionCoachRoles: string[]
      playerRelation?: {
        playerId: string
        playerName: string
      }
    }
  ]
}
```

### Update Coaching Structure
```typescript
PATCH /api/teams/{teamId}/users/{userId}/coaching-structure
Body: {
  coordinatorRole?: string | null
  positionCoachRoles?: string[]
}
Response: {
  success: boolean
}
```

## Testing Checklist

- [ ] Settings page loads with sidebar navigation
- [ ] Users section visible to head coaches only
- [ ] Assistant coaches list shows all assistants
- [ ] Players list shows all players
- [ ] Parents list shows all parents with player relations
- [ ] Coordinator role dropdown works
- [ ] Only one coordinator per role can be assigned
- [ ] Position coach roles can be toggled
- [ ] Multiple position roles can be assigned to one coach
- [ ] Multiple coaches can have the same position role
- [ ] Changes save successfully
- [ ] Error handling works (e.g., trying to assign taken coordinator role)

## Supabase Migration

**File:** `supabase/migrations/20260318000000_coaching_structure.sql`

**To Apply:**
1. Run via Supabase CLI: `supabase migration up`
2. Or via Supabase Dashboard SQL Editor

**What It Does:**
- Adds `coordinator_role` and `position_coach_roles` columns
- Creates validation functions
- Creates trigger to enforce single coordinator per role
- Adds indexes for performance

## Related Files

- `app/(portal)/dashboard/settings/page.tsx` - Settings page
- `components/portal/settings-layout.tsx` - Settings layout with sidebar
- `components/portal/settings-sections/users-list-settings.tsx` - Users list component
- `app/api/teams/[teamId]/users/route.ts` - Get team users API
- `app/api/teams/[teamId]/users/[userId]/coaching-structure/route.ts` - Update coaching structure API
- `supabase/migrations/20260318000000_coaching_structure.sql` - Database migration

## Future Enhancements

1. **Role Permissions:**
   - Use coordinator roles for access control
   - Use position coach roles for roster filtering

2. **Visual Coaching Chart:**
   - Display coaching structure as an org chart
   - Show hierarchy and relationships

3. **Bulk Assignment:**
   - Assign multiple position roles at once
   - Import coaching structure from CSV

4. **Notifications:**
   - Notify coaches when assigned coordinator roles
   - Notify when position roles change
