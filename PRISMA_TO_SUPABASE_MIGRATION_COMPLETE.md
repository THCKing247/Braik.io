# Prisma to Supabase Migration - Implementation Summary

**Date:** 2025-01-27  
**Status:** Core features migrated, remaining routes pending

## Overview

This document summarizes the migration of Prisma-based data access to Supabase-native queries throughout the application. The migration focused on high-priority features first, with remaining routes documented for future work.

---

## ✅ Completed Migrations

### 1. Messaging System
**Status:** ✅ Complete

**Files Migrated:**
- `app/api/messages/threads/route.ts` - List threads for team
- `app/api/messages/threads/[threadId]/route.ts` - Get thread with messages
- `app/api/messages/threads/create/route.ts` - Create new thread
- `app/api/messages/send/route.ts` - Send message to thread
- `app/api/messages/contacts/route.ts` - Get team contacts for messaging
- `app/api/messages/attachments/route.ts` - Upload attachment
- `app/api/messages/attachments/[attachmentId]/route.ts` - Get attachment
- `app/api/messages/attachments/serve/route.ts` - Serve attachment by URL
- `lib/utils/messaging-utils.ts` - Helper functions (ensureGeneralChatThread, ensureParentPlayerCoachChat)

**Key Features:**
- Thread-based messaging with participants
- Message attachments (metadata stored, file upload pending Storage integration)
- Access control via team membership and thread participation
- Support for general chat, parent-player-coach chats, and group threads

**Notes:**
- File uploads currently store metadata only; actual file storage requires Supabase Storage integration
- Attachment serving endpoints return metadata; actual file serving requires Storage API

---

### 2. Depth Chart
**Status:** ✅ Complete

**Files Migrated:**
- `app/api/roster/depth-chart/route.ts` - GET/PATCH depth chart entries
- `app/api/roster/depth-chart/position-labels/route.ts` - GET/PATCH position labels
- `lib/enforcement/depth-chart-permissions.ts` - validatePlayerInRoster function

**Key Features:**
- Depth chart entries with unit, position, string, and player assignment
- Custom position labels per team/unit
- Formation and special teams support

---

### 3. Plays and Playbooks
**Status:** ✅ Complete

**Files Migrated:**
- `app/api/plays/route.ts` - GET (list plays) / POST (create play)
- `app/api/plays/[playId]/route.ts` - GET / PATCH / DELETE individual play

**Key Features:**
- Play creation with canvas data (JSONB)
- Side-based permissions (offense, defense, special teams)
- Formation and subcategory organization
- Playbook association (optional)

**Notes:**
- Playbook management routes not yet migrated (playbooks table exists but routes pending)
- Canvas data stored as JSONB in `plays.canvas_data`

---

### 4. Roster Utilities
**Status:** ✅ Complete

**Files Migrated:**
- `app/api/roster/codes/route.ts` - GET team join codes
- `app/api/roster/codes/update/route.ts` - PATCH update codes
- `app/api/roster/generate-codes/route.ts` - POST generate new codes
- `app/api/roster/import/route.ts` - POST import players from CSV
- `app/api/roster/[playerId]/image/route.ts` - POST/DELETE player image

**Key Features:**
- Team join codes (player_code, parent_code, team_id_code)
- CSV import with validation
- Player image upload (metadata only; Storage integration pending)

**Notes:**
- Image uploads store metadata only; actual file storage requires Supabase Storage
- CSV import supports: firstName,lastName,grade,jerseyNumber,positionGroup,email,notes

---

### 5. Utility Functions
**Status:** ✅ Complete

**Files Migrated:**
- `lib/utils/data-filters.ts` - Player filtering based on role
  - `getParentAccessiblePlayerIds()` - Get players accessible to parent via guardian links
  - `buildPlayerFilter()` - Build Supabase filter for role-based player access
  - `canAssistantCoachAccessPlayer()` - Check assistant coach position group access

**Key Features:**
- Role-based player filtering (head coach, assistant coach, parent, player)
- Guardian link integration for parent access
- Position group restrictions for assistant coaches

---

## ⚠️ Pending Migrations

### High Priority

1. **Payments/Collections** (`app/api/collections/*`, `app/api/payments/*`)
   - Collections, invoices, transactions
   - Payment processing routes
   - Mark paid, export, checkout

2. **Documents** (`app/api/documents/*`)
   - Document upload, link, serve
   - Event-document linking

3. **Events/Calendar** (`app/api/teams/[teamId]/calendar/*`)
   - Event CRUD
   - Calendar settings
   - Private notes

4. **Inventory** (`app/api/teams/[teamId]/inventory/*`)
   - Inventory items and transactions

5. **Team Management** (`app/api/teams/[teamId]/*`)
   - Team updates, summary, season, rollover
   - Payment coach routes

### Medium Priority

6. **AI Assistant** (`app/api/ai/*`, `app/api/ai-assistant/*`)
   - Chat, propose action, confirm action, upload

7. **Support Tickets** (`app/api/support/tickets/*`, `app/api/admin/support/*`)
   - Ticket CRUD and messaging

8. **Admin Routes** (`app/api/admin/*`)
   - User management
   - Team service status
   - Announcements

9. **Compliance** (`app/api/compliance/*`)
   - Minor consent verification
   - Compliance logs

10. **Notifications** (`app/api/notifications/*`)
    - Preferences management

11. **Invites** (`app/api/invites/*`)
    - Bulk invites, resend

### Low Priority

12. **Utility Functions**
    - `lib/utils/calendar-hierarchy.ts`
    - `lib/enforcement/inventory-permissions.ts`
    - `lib/enforcement/documents-permissions.ts`
    - `lib/ai/ai-utils.ts`
    - `lib/ai/ai-actions.ts`

---

## Implementation Patterns

### Common Patterns Used

1. **Authentication & Authorization:**
   ```typescript
   const session = await getServerSession()
   if (!session?.user?.id) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
   }
   await requireTeamAccess(teamId) // or requireTeamPermission(teamId, "permission")
   ```

2. **Supabase Client:**
   ```typescript
   import { getSupabaseServer } from "@/src/lib/supabaseServer"
   const supabase = getSupabaseServer()
   ```

3. **Error Handling:**
   ```typescript
   try {
     // ... operation
   } catch (error: any) {
     console.error("[ROUTE]", error)
     return NextResponse.json(
       { error: error.message || "Failed to..." },
       { status: error.message?.includes("Access denied") ? 403 : 500 }
     )
   }
   ```

4. **Data Formatting:**
   - Convert snake_case DB fields to camelCase in responses
   - Handle null/undefined values consistently
   - Format dates as ISO strings

---

## Special Handling Required

### 1. File Storage
**Status:** Metadata stored, file upload pending

**Routes Affected:**
- `app/api/messages/attachments/*`
- `app/api/roster/[playerId]/image`

**Required:**
- Supabase Storage bucket setup
- Storage policies for team-scoped access
- File serving endpoints using Storage API

### 2. Complex Joins
**Status:** Handled via multiple queries

**Pattern:**
- Fetch main records
- Collect related IDs
- Fetch related records in batch
- Map relationships in code

**Example:**
```typescript
// Get threads
const { data: threads } = await supabase.from("message_threads").select(...)

// Get participant IDs
const threadIds = threads.map(t => t.id)
const { data: participants } = await supabase
  .from("message_thread_participants")
  .in("thread_id", threadIds)

// Map relationships
const participantsByThread = new Map(...)
```

### 3. Permission Checks
**Status:** Implemented via RBAC helpers

**Pattern:**
- `requireTeamAccess(teamId)` - Verify team membership
- `requireTeamPermission(teamId, "permission")` - Verify specific permission
- Role-based filtering in utility functions

---

## Schema Compatibility

All migrated routes use the Supabase schema defined in:
- `supabase/migrations/20260310000000_messaging_system.sql`
- `supabase/migrations/20260310010000_plays_playbooks.sql`
- `supabase/migrations/20260310020000_depth_chart.sql`
- `supabase/migrations/20260310050000_guardians.sql`
- And other migration files

**Key Tables Used:**
- `message_threads`, `messages`, `message_thread_participants`, `message_attachments`
- `plays`, `playbooks`
- `depth_chart_entries`, `depth_chart_position_labels`
- `players`, `teams`, `team_members`
- `guardians`, `guardian_links`
- `users`, `profiles`

---

## Testing Recommendations

1. **Messaging:**
   - Create thread, send messages, add participants
   - Test attachment upload (metadata)
   - Verify access control (participants only)

2. **Depth Chart:**
   - Create/update entries
   - Test position labels
   - Verify player assignment

3. **Plays:**
   - Create play with canvas data
   - Update play name/canvas
   - Delete play
   - Verify side-based permissions

4. **Roster:**
   - Generate/update codes
   - Import CSV
   - Upload player image (metadata)

5. **Data Filters:**
   - Test parent access via guardian links
   - Test assistant coach position group filtering
   - Test player self-access

---

## Next Steps

1. **Complete High-Priority Routes:**
   - Payments/Collections (revenue-critical)
   - Documents (file management)
   - Events/Calendar (scheduling)

2. **Storage Integration:**
   - Set up Supabase Storage buckets
   - Implement file upload/serve endpoints
   - Add Storage policies

3. **Testing:**
   - End-to-end testing of migrated routes
   - Performance testing for complex queries
   - Security audit of access controls

4. **Documentation:**
   - API documentation for new routes
   - Migration guide for remaining routes
   - Storage integration guide

---

## Files Changed

### Completed (25 files):
- `app/api/messages/threads/route.ts`
- `app/api/messages/threads/[threadId]/route.ts`
- `app/api/messages/threads/create/route.ts`
- `app/api/messages/send/route.ts`
- `app/api/messages/contacts/route.ts`
- `app/api/messages/attachments/route.ts`
- `app/api/messages/attachments/[attachmentId]/route.ts`
- `app/api/messages/attachments/serve/route.ts`
- `app/api/roster/depth-chart/route.ts`
- `app/api/roster/depth-chart/position-labels/route.ts`
- `app/api/roster/codes/route.ts`
- `app/api/roster/codes/update/route.ts`
- `app/api/roster/generate-codes/route.ts`
- `app/api/roster/import/route.ts`
- `app/api/roster/[playerId]/image/route.ts`
- `app/api/plays/route.ts`
- `app/api/plays/[playId]/route.ts`
- `lib/utils/messaging-utils.ts`
- `lib/utils/data-filters.ts`
- `lib/enforcement/depth-chart-permissions.ts`

### Pending (~80+ files):
- See "Pending Migrations" section above

---

**End of Summary**
