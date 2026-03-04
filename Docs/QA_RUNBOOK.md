# QA & Test Logging Runbook

This runbook provides guidance for troubleshooting common issues, understanding the logging system, and reproducing problems in the Braik application.

## Table of Contents

1. [Logging System Overview](#logging-system-overview)
2. [Where Logs Live](#where-logs-live)
3. [Common Failures](#common-failures)
4. [How to Reproduce Issues](#how-to-reproduce-issues)
5. [Test Scaffolding](#test-scaffolding)
6. [Debugging Workflows](#debugging-workflows)

---

## Logging System Overview

Braik uses structured logging to track key actions and failures. All logs are written in JSON format for easy parsing and analysis.

### Logged Actions

The following actions are automatically logged:

- **Permission Denials**: When users attempt actions they don't have permission for
- **Message Actions**: Message sends and thread creation
- **Event Actions**: Event creation, updates, and deletions
- **Depth Chart Edits**: Changes to depth chart entries
- **Billing State Transitions**: Changes in account status (ACTIVE, GRACE, READ_ONLY, LOCKED)
- **AI Actions**: AI action proposals, approvals, rejections, and executions
- **Admin Overrides**: Platform owner actions (when implemented)

### Log Format

All logs follow this structure:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info|warn|error",
  "action": "permission_denied|message_sent|event_created|...",
  "userId": "user-id",
  "teamId": "team-id",
  "role": "HEAD_COACH|ASSISTANT_COACH|PLAYER|PARENT",
  "metadata": { /* action-specific data */ }
}
```

---

## Where Logs Live

### Development Environment

In development, logs are written to the **console** (stdout/stderr). You'll see them in:

- Terminal/console where the Next.js dev server is running
- Docker logs (if running in containers): `docker-compose logs -f`

### Production Environment

In production, logs should be:

1. **Console output** (captured by your hosting platform)
2. **External logging service** (to be configured):
   - CloudWatch (AWS)
   - Datadog
   - Sentry
   - Or your preferred logging service

### Log File Locations

Currently, logs are **not written to files** by default. They are:
- Streamed to console in development
- Should be captured by your hosting platform's log aggregation in production

To enable file logging, modify `lib/structured-logger.ts` to write to files.

### Database Audit Logs

In addition to structured logs, Braik maintains an `AuditLog` table in the database:

```sql
SELECT * FROM "AuditLog" 
WHERE "teamId" = 'your-team-id' 
ORDER BY "createdAt" DESC 
LIMIT 50;
```

This provides a persistent record of actions for compliance and debugging.

---

## Common Failures

### 1. Permission Denials

**Symptoms:**
- User receives "Access denied" or "Insufficient permissions" errors
- Actions fail with 403 status codes

**What to Check:**
1. Look for `[permission_denied]` logs in console
2. Verify user's role in the `Membership` table
3. Check if the action requires a specific permission
4. Verify billing state (read-only mode blocks many actions)

**Log Example:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "warn",
  "action": "permission_denied",
  "userId": "user-123",
  "teamId": "team-456",
  "role": "ASSISTANT_COACH",
  "requiredPermission": "manage_billing",
  "reason": "Insufficient permissions for manage_billing"
}
```

**How to Fix:**
- Verify user has correct role assignment
- Check if action requires HEAD_COACH role
- Ensure billing state allows the action (not in READ_ONLY mode)

---

### 2. Read-Only Mode Issues

**Symptoms:**
- Users cannot create/edit events
- Messages cannot be sent
- Depth charts cannot be edited
- AI actions are blocked

**What to Check:**
1. Look for `[billing_state_transition]` logs
2. Check team's `accountStatus` in database
3. Verify payment status: `amountPaid` vs `subscriptionAmount`
4. Check if in grace period (June/July or before first game week)

**Log Example:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "action": "billing_state_transition",
  "teamId": "team-456",
  "fromStatus": "ACTIVE",
  "toStatus": "READ_ONLY",
  "reason": "Payment required - account is in read-only mode"
}
```

**How to Fix:**
- Update payment status in database
- Call `syncTeamAccountStatus()` after payment updates
- Verify grace period dates if in pre-season

---

### 3. Message/Thread Creation Failures

**Symptoms:**
- Messages fail to send
- Threads cannot be created
- "Read-only access" errors

**What to Check:**
1. Look for `[message_sent]` or `[thread_created]` logs
2. Check for `[permission_denied]` logs
3. Verify user is a thread participant
4. Check if user has read-only access (parent visibility)

**Log Example:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "action": "message_sent",
  "userId": "user-123",
  "teamId": "team-456",
  "role": "HEAD_COACH",
  "threadId": "thread-789",
  "messageId": "msg-012"
}
```

**How to Fix:**
- Verify user is a thread participant
- Check if user has read-only access (parents cannot send messages)
- Ensure billing state allows messaging

---

### 4. Event Creation/Edit Failures

**Symptoms:**
- Events cannot be created
- Events cannot be edited
- "Insufficient permissions" errors

**What to Check:**
1. Look for `[event_created]`, `[event_updated]`, or `[event_deleted]` logs
2. Check for `[permission_denied]` logs
3. Verify hierarchical permissions (coordinators can only edit their unit's events)
4. Check billing state

**Log Example:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "action": "event_created",
  "userId": "user-123",
  "teamId": "team-456",
  "role": "ASSISTANT_COACH",
  "eventId": "event-789",
  "eventType": "PRACTICE",
  "title": "Practice Session"
}
```

**How to Fix:**
- Verify user has permission to create/edit events for the scope
- Check hierarchical scoping (unit, position group)
- Ensure billing state allows event editing

---

### 5. Depth Chart Edit Failures

**Symptoms:**
- Depth chart updates fail
- "You do not have permission" errors

**What to Check:**
1. Look for `[depth_chart_edited]` logs
2. Check for `[permission_denied]` logs
3. Verify unit-level permissions (coordinators can edit their unit)
4. Verify position-level permissions (position coaches can edit their positions)

**Log Example:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "action": "depth_chart_edited",
  "userId": "user-123",
  "teamId": "team-456",
  "role": "ASSISTANT_COACH",
  "entriesCount": 5,
  "unit": "OFFENSE",
  "position": "QB"
}
```

**How to Fix:**
- Verify user has permission for the unit (OFFENSE, DEFENSE, SPECIAL_TEAMS)
- Check position group permissions for position coaches
- Ensure billing state allows depth chart editing

---

### 6. AI Action Failures

**Symptoms:**
- AI actions cannot be proposed
- AI actions cannot be confirmed
- "AI access disabled" errors

**What to Check:**
1. Look for `[ai_action_proposed]`, `[ai_action_approved]`, `[ai_action_executed]` logs
2. Check for `[permission_denied]` logs
3. Verify `aiEnabled` flag on team
4. Check `aiDisabledByPlatform` flag
5. Verify billing state allows AI usage

**Log Example:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "action": "ai_action_proposed",
  "userId": "user-123",
  "teamId": "team-456",
  "role": "ASSISTANT_COACH",
  "proposalId": "proposal-789",
  "actionType": "create_events",
  "requiresApproval": true
}
```

**How to Fix:**
- Verify AI is enabled for the team (`aiEnabled = true`)
- Check if platform owner disabled AI (`aiDisabledByPlatform = false`)
- Ensure billing state allows AI usage
- Verify user is a coach (not player/parent)

---

## How to Reproduce Issues

### 1. Permission Denial Issues

**Steps:**
1. Create a test user with a specific role (e.g., ASSISTANT_COACH)
2. Attempt an action that requires higher permissions (e.g., manage billing)
3. Check console logs for `[permission_denied]` entry
4. Verify log contains correct userId, teamId, role, and reason

**Test File:** `tests/permissions.test.ts`

---

### 2. Read-Only Mode Issues

**Steps:**
1. Set team's `accountStatus` to "READ_ONLY" in database
2. Or set `amountPaid < subscriptionAmount` and ensure past grace period
3. Attempt to create/edit events, send messages, or edit depth charts
4. Verify actions are blocked with appropriate error messages
5. Check logs for billing state transitions

**Test File:** `tests/read-only-mode.test.ts`

---

### 3. Visibility Rule Issues

**Steps:**
1. Create a thread with a player participant
2. Verify parent is automatically added as read-only participant (HS teams)
3. Attempt to send message as parent (should fail)
4. Verify parent can view thread but cannot send messages
5. Check logs for permission denials

**Test File:** `tests/visibility-rules.test.ts`

---

### 4. Event Hierarchy Issues

**Steps:**
1. Create an event scoped to a specific unit (e.g., OFFENSE)
2. Attempt to edit as a coordinator of different unit (e.g., DEFENSE)
3. Verify edit is blocked
4. Check logs for permission denial
5. Verify coordinator of same unit can edit

**Test File:** `tests/visibility-rules.test.ts`

---

### 5. Billing State Transition Issues

**Steps:**
1. Set team to GRACE period (June/July or before first game week)
2. Verify full access is available
3. Move past grace period without payment
4. Verify state transitions to READ_ONLY
5. Check logs for `[billing_state_transition]` entry

**Test File:** `tests/read-only-mode.test.ts`

---

## Test Scaffolding

Test scaffolding files are located in the `tests/` directory:

- **`permissions.test.ts`**: Role permission check tests
- **`visibility-rules.test.ts`**: Parent/player view and event visibility tests
- **`read-only-mode.test.ts`**: Billing state and read-only mode tests

### Running Tests

To run tests, you'll need to set up a test framework (Jest, Vitest, etc.):

```bash
# Install test framework (example with Vitest)
npm install -D vitest @vitest/ui

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

### Test Helpers

Each test file provides helper functions:

- `createMockMembership()`: Create test membership
- `createMockThread()`: Create test thread with participants
- `createMockEvent()`: Create test event with scoping
- `createMockBillingContext()`: Create test billing context

---

## Debugging Workflows

### Workflow 1: User Cannot Perform Action

1. **Check Logs**: Search console for `[permission_denied]` or action-specific logs
2. **Verify Role**: Check user's role in database
3. **Check Billing**: Verify billing state allows the action
4. **Test Permissions**: Use test scaffolding to verify permission logic
5. **Check Hierarchy**: For events/depth charts, verify hierarchical permissions

### Workflow 2: Billing State Issues

1. **Check Logs**: Look for `[billing_state_transition]` entries
2. **Verify Dates**: Check grace period dates, first game week, payment due date
3. **Check Payment**: Verify `amountPaid >= subscriptionAmount`
4. **Test State**: Use `getTeamBillingState()` to calculate current state
5. **Sync Status**: Call `syncTeamAccountStatus()` after payment updates

### Workflow 3: AI Action Failures

1. **Check Logs**: Look for `[ai_action_proposed]`, `[ai_action_approved]`, etc.
2. **Verify AI Flags**: Check `aiEnabled` and `aiDisabledByPlatform` on team
3. **Check Billing**: Verify billing state allows AI usage
4. **Verify Role**: Ensure user is a coach (not player/parent)
5. **Check Approval**: Verify action requires approval and was approved by HEAD_COACH

### Workflow 4: Message/Thread Issues

1. **Check Logs**: Look for `[message_sent]` or `[thread_created]` entries
2. **Verify Participation**: Check if user is a thread participant
3. **Check Read-Only**: Verify if user has read-only access (parent visibility)
4. **Check Billing**: Ensure billing state allows messaging
5. **Verify Permissions**: Check if user can create threads (coaches only)

---

## Quick Reference

### Log Actions

| Action | Description | Log Level |
|--------|-------------|-----------|
| `permission_denied` | User attempted unauthorized action | `warn` |
| `message_sent` | Message was sent in thread | `info` |
| `thread_created` | New message thread created | `info` |
| `event_created` | Event was created | `info` |
| `event_updated` | Event was updated | `info` |
| `event_deleted` | Event was deleted | `info` |
| `depth_chart_edited` | Depth chart was modified | `info` |
| `billing_state_transition` | Account status changed | `info` |
| `ai_action_proposed` | AI action was proposed | `info` |
| `ai_action_approved` | AI action was approved | `info` |
| `ai_action_rejected` | AI action was rejected | `info` |
| `ai_action_executed` | AI action was executed | `info` |
| `admin_override` | Platform owner override | `warn` |

### Common Database Queries

```sql
-- Check user's role
SELECT role FROM "Membership" WHERE "userId" = 'user-id' AND "teamId" = 'team-id';

-- Check billing state
SELECT "accountStatus", "amountPaid", "subscriptionAmount", "aiEnabled", "aiDisabledByPlatform" 
FROM "Team" WHERE id = 'team-id';

-- View recent audit logs
SELECT * FROM "AuditLog" 
WHERE "teamId" = 'team-id' 
ORDER BY "createdAt" DESC 
LIMIT 20;

-- Check thread participants
SELECT * FROM "ThreadParticipant" WHERE "threadId" = 'thread-id';
```

---

## Next Steps

1. **Set up external logging service** for production
2. **Configure log aggregation** in your hosting platform
3. **Set up alerting** for critical errors (permission denials, billing issues)
4. **Create dashboards** for monitoring log patterns
5. **Implement log retention policies** for compliance

---

## Support

For issues or questions:
1. Check this runbook first
2. Review logs in console/database
3. Use test scaffolding to reproduce issues
4. Check `Documents/BRAIK_MASTER_INTENT.md` for system design
