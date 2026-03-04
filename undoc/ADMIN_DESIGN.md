# Platform Owner Admin System Design

## Overview
This document outlines the design for the Platform Owner (Super Admin) system, providing ultimate authority across all programs while maintaining strict audit trails and safety controls.

## Permissions Model

### Platform Owner Role
- **Identification**: User has `isPlatformOwner: true` flag in User model (or via environment variable for initial setup)
- **Scope**: Cross-program access to all data
- **Constraints**: All actions must be audited; destructive actions require strong confirmations

### Permission Checks
All admin routes must verify Platform Owner status via `requirePlatformOwner()` helper.

## Route Map

### Program Management
- `GET /api/admin/programs` - List all programs with status, billing info, AI status
- `GET /api/admin/programs/[programId]` - Get detailed program information
- `PATCH /api/admin/programs/[programId]` - Update program details
- `PATCH /api/admin/programs/[programId]/billing` - Adjust billing (mark paid, extend grace, set due date)
- `PATCH /api/admin/programs/[programId]/ai` - Enable/disable AI usage for program
- `POST /api/admin/programs/[programId]/archive` - Soft delete (archive) program
- `DELETE /api/admin/programs/[programId]` - Hard delete program (requires confirmation)

### User Management
- `GET /api/admin/users` - List all users (with filtering)
- `GET /api/admin/users/[userId]` - Get detailed user information
- `PATCH /api/admin/users/[userId]` - Update user details
- `POST /api/admin/users/[userId]/sessions/revoke` - Force logout user (revoke all sessions)
- `POST /api/admin/users/[userId]/archive` - Soft delete (archive) user
- `DELETE /api/admin/users/[userId]` - Hard delete user (requires confirmation)

### Message Viewing (Dispute Resolution)
- `GET /api/admin/messages/threads/[threadId]` - View thread metadata and all messages
- `GET /api/admin/messages/search` - Search messages by criteria (team, user, date range)

### Impersonation (Read-Only View-As)
- `POST /api/admin/impersonate/[userId]` - Start read-only impersonation session
  - Returns temporary session token
  - Logs impersonation start with time limit
  - Maximum session duration: 1 hour
- `POST /api/admin/impersonate/end` - End current impersonation session
- `GET /api/admin/impersonate/verify` - Verify current session is impersonation (for UI guards)

### Audit Logs
- `GET /api/admin/audit` - View audit logs with filtering (action, actor, team, date range)

## Data Model Changes

### User Model
```prisma
model User {
  // ... existing fields
  isPlatformOwner Boolean @default(false)
  archivedAt      DateTime?
  deletedAt       DateTime?
  impersonationSessions ImpersonationSession[] @relation("ImpersonatedUser")
}
```

### Team Model
```prisma
model Team {
  // ... existing fields
  aiEnabled       Boolean  @default(true)
  archivedAt      DateTime?
  deletedAt       DateTime?
  gracePeriodEnds DateTime? // For billing grace period extension
}
```

### New Model: ImpersonationSession
```prisma
model ImpersonationSession {
  id              String   @id @default(cuid())
  adminUserId     String   // Platform Owner who started impersonation
  impersonatedUserId String // User being impersonated
  startedAt       DateTime @default(now())
  expiresAt       DateTime // Maximum 1 hour from start
  endedAt         DateTime?
  sessionToken    String   @unique // Temporary token for impersonation
  metadata        Json?    // Additional context
  
  admin       User @relation("ImpersonationAdmin", fields: [adminUserId], references: [id])
  impersonatedUser User @relation("ImpersonatedUser", fields: [impersonatedUserId], references: [id])
  
  @@index([adminUserId])
  @@index([impersonatedUserId])
  @@index([sessionToken])
  @@index([expiresAt])
}
```

## Security & Audit Requirements

### All Admin Actions Must:
1. Verify Platform Owner status
2. Create audit log entry with:
   - Action type
   - Actor (Platform Owner user ID)
   - Target (program/user ID)
   - Metadata (what changed)
   - Timestamp

### Destructive Actions (Delete/Archive):
1. Require explicit confirmation parameter
2. Create detailed audit log
3. For hard delete: Additional confirmation token required

### Impersonation:
1. Read-only mode enforced at API level
2. All impersonation actions logged
3. Time-bounded (max 1 hour)
4. Cannot send messages or modify data while impersonating
5. UI must clearly indicate impersonation mode

## Messaging Contact Restriction

### Enforcement:
- Only Head Coaches can create threads/messages with Platform Owner
- Check in message creation API: If recipient is Platform Owner, verify sender is Head Coach
- Platform Owner can view all messages but cannot initiate contact (except via admin tools)

## Implementation Notes

1. **Schema Changes**: Ask before modifying shared schemas/models
2. **Read-Only Impersonation**: All write operations must check for impersonation session and reject
3. **Soft Delete**: Archived items are hidden from normal queries but preserved for audit
4. **Hard Delete**: Permanent removal, only after soft delete and strong confirmation
5. **Billing Adjustments**: Track original vs adjusted amounts in audit logs

## API Response Format

All admin routes return consistent format:
```typescript
{
  success: boolean
  data?: any
  error?: string
  auditLogId?: string // For actions that create audit logs
}
```
