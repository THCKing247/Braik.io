# AI Action API Contract

## Overview

This document defines the safe command interface for the AI Assistant to execute actions across Braik. All actions must respect role hierarchy, permissions, and approval requirements as specified in BRAIK_MASTER_INTENT.md.

## Action Types

### 1. Information Actions (No Approval Required)
These actions only retrieve or display information and require no confirmation.

- `get_schedule` - Retrieve upcoming events
- `get_roster` - Retrieve roster information (role-scoped)
- `get_announcements` - Retrieve recent announcements
- `get_team_info` - Retrieve team metadata
- `answer_question` - General Q&A (no data mutation)

### 2. Content Drafting Actions (No Approval Required)
These actions generate content but do not execute changes.

- `draft_announcement` - Generate announcement text
- `draft_event_description` - Generate event description
- `draft_message` - Generate message text
- `summarize_content` - Summarize provided content

### 3. Direct Execution Actions (No Approval Required)
These actions execute immediately but are reversible and scoped to user's permissions.

- `create_event` - Create calendar event (respects role hierarchy)
- `update_event` - Update existing event (if user has edit permission)
- `send_message` - Send message in thread (if user has access)
- `create_document` - Upload document (if user has permission)

**Constraints:**
- Events must respect hierarchical scoping (coordinators → units, position coaches → players)
- Messages can only be sent to threads user has access to
- Cannot create parent announcements (requires approval)

### 4. Approval-Required Actions
These actions require explicit Head Coach approval before execution.

- `create_parent_announcement` - Announcement to parents (Head Coach only)
- `modify_roster` - Add/remove/update players (Head Coach approval required)
- `bulk_create_events` - Create multiple events from file upload
- `modify_depth_chart` - Change depth chart positions (if roster-affecting)

## API Endpoints

### POST /api/ai/chat
Main chat interface that detects user intent and either:
- Answers questions directly
- Proposes actions for approval
- Executes safe actions immediately

**Request:**
```json
{
  "teamId": "string",
  "message": "string",
  "conversationHistory": [{"role": "user|assistant", "content": "string"}]
}
```

**Response (Question/Answer):**
```json
{
  "type": "response",
  "response": "string",
  "usage": {
    "tokensUsed": 150,
    "roleWeight": 1.0
  }
}
```

**Response (Action Proposal):**
```json
{
  "type": "action_proposal",
  "proposalId": "string",
  "actionType": "create_parent_announcement",
  "preview": {
    "title": "string",
    "body": "string",
    "affectedRecords": []
  },
  "requiresApproval": true,
  "approverRole": "HEAD_COACH"
}
```

**Response (Direct Execution):**
```json
{
  "type": "action_executed",
  "actionType": "create_event",
  "result": {
    "eventId": "string",
    "title": "string"
  },
  "usage": {
    "tokensUsed": 200,
    "roleWeight": 1.0
  }
}
```

### POST /api/ai/propose-action
AI proposes an action after analyzing user input or uploaded file.

**Request:**
```json
{
  "teamId": "string",
  "actionType": "bulk_create_events",
  "source": "file_upload|user_request",
  "attachmentId": "string?",
  "extractedData": {},
  "userIntent": "string"
}
```

**Response:**
```json
{
  "proposalId": "string",
  "actionType": "string",
  "preview": {
    "summary": "string",
    "items": [
      {
        "type": "event",
        "title": "string",
        "date": "ISO8601",
        "location": "string?"
      }
    ],
    "affectedCount": 5
  },
  "requiresApproval": true,
  "approverRole": "HEAD_COACH",
  "estimatedImpact": "low|medium|high"
}
```

### POST /api/ai/confirm-action
Executes a confirmed action proposal. Only Head Coach can confirm approval-required actions.

**Request:**
```json
{
  "proposalId": "string",
  "confirmedItems": ["itemId1", "itemId2"], // Optional: selective confirmation
  "notes": "string?" // Optional approval notes
}
```

**Response:**
```json
{
  "success": true,
  "executedItems": [
    {
      "id": "string",
      "type": "event|announcement|roster_change",
      "result": {}
    }
  ],
  "auditLogId": "string"
}
```

## Action Execution Rules

### Role-Based Permissions

1. **Head Coach**
   - Can execute all actions
   - Can approve all approval-required actions
   - Full context access

2. **Assistant Coach (Coordinators)**
   - Can create events scoped to their unit
   - Can send messages to their unit
   - Cannot create parent announcements
   - Cannot modify roster
   - Context limited to their unit

3. **Position Coaches**
   - Can create events scoped to their position group
   - Can send messages to their players
   - Cannot create parent announcements
   - Cannot modify roster
   - Context limited to their position group

4. **Players**
   - Information-only actions
   - Cannot execute any mutations
   - Context limited to their own data

5. **Parents**
   - Information-only actions
   - Cannot execute any mutations
   - Context limited to their child's data

### Approval Flow

1. AI detects action requiring approval
2. Creates `AIActionProposal` with status `pending`
3. Returns proposal to user with preview
4. User reviews proposal in confirmation UI
5. Head Coach confirms or rejects
6. If confirmed, action executes and proposal status → `executed`
7. Audit log entry created

### Reversibility

All executed actions must be reversible:
- Events can be deleted
- Messages can be deleted (by sender or Head Coach)
- Announcements can be deleted (by Head Coach)
- Roster changes logged in audit trail

## Cost Controls

### Usage Tracking
- Track tokens used per program
- Role-weighted: Head Coach = 1.0x, Coordinators = 0.75x, Position Coaches = 0.5x, Players/Parents = 0.25x
- Track per season

### Soft Caps
- Near limit (80%): Degrade to suggestion-only mode
- At limit (100%): Block AI execution, show upgrade prompt
- Platform Owner can disable AI per program

### Premium Gating
- AI only available for paid programs (`subscriptionPaid = true`)
- Additional AI premium required (`aiEnabled = true`)
- Platform Owner can override (`aiDisabledByPlatform = true`)

## Error Handling

### Insufficient Permissions
```json
{
  "error": "insufficient_permissions",
  "message": "Only Head Coach can create parent announcements",
  "requiredRole": "HEAD_COACH"
}
```

### Approval Required
```json
{
  "error": "approval_required",
  "proposalId": "string",
  "message": "This action requires Head Coach approval"
}
```

### Usage Limit Reached
```json
{
  "error": "usage_limit_reached",
  "message": "AI usage limit reached. Upgrade to continue.",
  "currentUsage": 1000,
  "limit": 1000
}
```

### AI Disabled
```json
{
  "error": "ai_disabled",
  "message": "AI features are disabled for this program",
  "reason": "platform_disabled|not_premium|subscription_required"
}
```

## Security Considerations

1. All actions verify user membership and role
2. Context scoping enforced at database query level
3. Approval-required actions cannot bypass confirmation
4. Audit trail for all executed actions
5. Rate limiting per user/program
6. Input sanitization for all user-provided content

## Implementation Notes

- Action detection uses LLM function calling or structured output
- Context building respects role hierarchy and scoping
- Usage tracking happens synchronously before API response
- Approval UI component handles confirmation flow
- All mutations go through service layer, not direct Prisma calls
