# Dashboard Data Requirements

## Overview
This document outlines the data requirements for implementing a uniform, role-aware dashboard per BRAIK_MASTER_INTENT.md Section 10.1.

## Layout Structure
The dashboard must maintain a uniform layout across all roles:
1. **Program Header** (top)
2. **Calendar** (front-and-center, primary focus)
3. **Updates/Announcements** (underneath calendar)

## Data Requirements by Section

### 1. Program Header Data

#### Required Fields:
- **Team Name** (`Team.name`)
- **Slogan** (`Team.slogan`)
- **Organization Name** (`Organization.name`)
- **Sport** (`Team.sport`)
- **Season Name** (`Team.seasonName`)
- **Logo URL** (`Team.logoUrl`) - optional

#### Season Record Data:
- **Overall Record** (wins/losses)
  - Source: `Season.games[]` where `confirmedByCoach = true` and `result IS NOT NULL`
  - Calculate: Count `result = "win"` and `result = "loss"`
- **Conference Record** (wins/losses)
  - Source: Same as above, but filter `conferenceGame = true`
- **Division/Standing** (optional)
  - Source: `Season.division` (e.g., "Division I", "5A")
  - Note: External standings integrations are best-effort in v1
  - May be manually entered or stubbed if unavailable

#### Data Source:
- Primary: `Team` model with `organization` relation
- Season data: `Season` model (most recent by `year DESC`)
- Game data: `Game` model filtered by `seasonId` and `confirmedByCoach = true`

### 2. Calendar Data (Role-Scoped)

#### Base Query:
- All events for `teamId`
- Date range: Next 30 days (or configurable)
- Include: `scopedPlayerIds`, `scopedPositionGroups`, `scopedUnit`, `coordinatorType`, `createdBy`, `visibility`

#### Role-Specific Filtering:

**HEAD_COACH:**
- See all events (no filtering)

**PARENT:**
- Only Head Coach events (no scoping)
- Filter: `createdBy IN (Head Coach user IDs)` AND `scopedUnit IS NULL` AND `scopedPositionGroups IS NULL` AND `scopedPlayerIds IS NULL`
- Visibility: `"TEAM"` or `"PARENTS_AND_TEAM"`

**PLAYER:**
- Head Coach events (no scoping) + events scoped to player
- Filter logic:
  1. Events with no scoping (Head Coach events for entire program)
  2. Events scoped to player's unit (`scopedUnit` matches player's unit from `positionGroup`)
  3. Events scoped to player's position group (`scopedPositionGroups` includes player's `positionGroup`)
  4. Events specifically scoped to this player (`scopedPlayerIds` includes player's `id`)
- Visibility: `"TEAM"` or `"PARENTS_AND_TEAM"`

**ASSISTANT_COACH (Coordinator):**
- Head Coach events + events in their unit
- Filter logic:
  1. Events with no scoping (Head Coach events)
  2. Events where `scopedUnit` matches coordinator's unit
- Visibility: `"COACHES_ONLY"`, `"TEAM"`, or `"PARENTS_AND_TEAM"`

**ASSISTANT_COACH (Position Coach):**
- Head Coach events + events for their position groups
- Filter logic:
  1. Events with no scoping (Head Coach events)
  2. Events where `scopedPositionGroups` overlaps with coach's `positionGroups`
- Visibility: `"COACHES_ONLY"`, `"TEAM"`, or `"PARENTS_AND_TEAM"`

#### Helper Functions Needed:
- `getUnitForPositionGroup(positionGroup)` - from `lib/calendar-hierarchy.ts`
- `getCoordinatorType(membership)` - from `lib/calendar-hierarchy.ts`
- `getCoordinatorUnit(coordinatorType)` - from `lib/calendar-hierarchy.ts`

### 3. Updates/Announcements Data

#### Updates Feed:
- Source: `UpdatesFeed` model
- Filter: `teamId`
- Order: `createdAt DESC`
- Limit: 10 most recent

#### Announcements:
- Source: `Announcement` model
- Filter by `audience` field:
  - `"all"` → visible to all roles
  - `"players"` → visible to PLAYER role only
  - `"parents"` → visible to PARENT role only
  - `"staff"` → visible to HEAD_COACH and ASSISTANT_COACH only
- Order: `createdAt DESC`
- Limit: 10 most recent (or configurable)

#### Combined Display:
- Show both updates and announcements in a unified feed
- Or display separately (updates on left, announcements on right) per current layout

### 4. Additional Context Data

#### For Event Filtering:
- **Player Data** (for PLAYER role):
  - `Player.id`, `Player.positionGroup`, `Player.userId` (to match session user)
- **Membership Data** (for all roles):
  - `Membership.role`, `Membership.positionGroups`, `Membership.permissions`
- **Head Coach User IDs** (for PARENT role):
  - Query: `Membership.userId` where `role = "HEAD_COACH"` and `teamId = teamId`

## Implementation Notes

### Event Scoping Logic
The dashboard must replicate the filtering logic from `app/api/teams/[teamId]/calendar/events/route.ts` to ensure consistency.

### Performance Considerations
- Consider caching season/game data if frequently accessed
- Event filtering may require in-memory processing after initial query
- Player/position group lookups should be batched where possible

### Data Validation
- Handle cases where `Season` model doesn't exist or has no games
- Handle cases where player has no `positionGroup` assigned
- Handle cases where assistant coach has no `positionGroups` or `permissions.coordinatorType`

## Schema References

### Key Models:
- `Team` (lines 92-143 in schema.prisma)
- `Season` (lines 145-161 in schema.prisma)
- `Game` (lines 163-184 in schema.prisma)
- `Event` (lines 274-312 in schema.prisma)
- `Announcement` (lines 346-355 in schema.prisma)
- `UpdatesFeed` (referenced in Team relations)
- `Membership` (lines 186-200 in schema.prisma)
- `Player` (referenced in schema, includes `positionGroup` field)
- `Guardian` / `GuardianPlayer` (for parent-player linking)

### Key Fields:
- `Event.scopedPlayerIds` (Json?)
- `Event.scopedPositionGroups` (Json?)
- `Event.scopedUnit` (String?)
- `Event.coordinatorType` (String?)
- `Event.createdBy` (String)
- `Event.visibility` (String)
- `Announcement.audience` (String)
- `Season.division` (String?)
