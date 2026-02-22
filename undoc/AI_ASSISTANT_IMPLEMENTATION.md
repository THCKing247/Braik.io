# AI Assistant Implementation Summary

## Overview

This document summarizes the AI Assistant implementation for Braik, aligned with BRAIK_MASTER_INTENT.md specifications.

## Implementation Status

✅ **Completed**

All core features have been implemented according to the specification:

1. ✅ Action API Contract defined (`Docs/AI_ACTION_API_CONTRACT.md`)
2. ✅ Usage tracking schema (per program, role-weighted)
3. ✅ AI premium gating and cost controls
4. ✅ Role-weighted context system
5. ✅ Action execution layer with approval flows
6. ✅ Action confirmation UX component
7. ✅ Updated AI chat route with full context and usage tracking
8. ✅ Updated AI assistant components with confirmation flows

## Key Components

### 1. Schema Changes (`prisma/schema.prisma`)

Added two new models:

- **AIUsage**: Tracks aggregate usage per team/season
  - `tokensUsed`: Weighted tokens consumed
  - `requestsCount`: Number of AI requests
  - `seasonYear`: For per-season tracking

- **AIUsageRecord**: Individual usage records for detailed tracking
  - `tokensUsed`: Raw tokens used
  - `roleWeight`: Multiplier based on role
  - `weightedTokens`: Calculated weighted tokens
  - `actionType`: Type of action performed

### 2. Core Utilities (`lib/ai-utils.ts`)

- **Role-weighted usage tracking**: Head Coach = 1.0x, Coordinators = 0.75x, Position Coaches = 0.5x, Players/Parents = 0.25x
- **Usage status checking**: Tracks usage percentage, soft caps (80%), hard limits
- **AI premium gating**: Checks subscription, AI premium, platform disable flags
- **Role-scoped context building**: Builds context strings based on user role and permissions
- **Approval detection**: Determines if actions require Head Coach approval

### 3. Action Execution (`lib/ai-actions.ts`)

- **Safe actions**: Execute immediately (create event, send message, draft content)
- **Approval-required actions**: Create proposals for Head Coach review
  - Parent announcements (Head Coach only)
  - Roster modifications (Head Coach approval required)
  - Bulk operations
- **Action execution**: Executes confirmed proposals with audit logging

### 4. API Routes

#### `/api/ai/chat` (Updated)
- Full role-scoped context
- Usage tracking and limits
- Action detection and proposal creation
- Integration with billing state system
- Conversation history saving

#### `/api/ai/confirm-action` (Updated)
- GET: Retrieve proposal details for review
- POST: Execute confirmed actions (Head Coach only)
- Billing permission checks
- Audit logging

### 5. UI Components

#### `components/ai-action-confirmation.tsx`
- Review proposal details
- Show preview of affected records
- Confirm or reject actions
- Head Coach only

#### `components/ai-chatbot-widget.tsx` (Updated)
- Handle action proposals in chat
- Show confirmation UI inline
- Display usage statistics
- Error handling for disabled AI

## Approval Rules (Per Spec)

### Always Require Approval
1. **Parent Announcements**: Head Coach only, always requires confirmation
2. **Roster Modifications**: Any add/remove/update player actions require Head Coach approval
3. **Bulk Operations**: Creating multiple events from file uploads

### Direct Execution (No Approval)
- Creating events (respects role hierarchy)
- Sending messages (within user's access)
- Drafting content (no execution)
- Answering questions

## Cost Controls

### Usage Limits
- Default: 10,000 weighted tokens per season (configurable)
- Soft cap: 80% → Degrades to suggestion-only mode
- Hard limit: 100% → Blocks AI execution

### Role Weighting
- Head Coach: 1.0x (full weight)
- Assistant Coach (Coordinators): 0.75x
- Position Coaches: 0.5x
- Players/Parents: 0.25x

### Premium Gating
AI is only available when:
1. `subscriptionPaid = true` (base subscription paid)
2. `aiEnabled = true` (AI premium purchased)
3. `aiDisabledByPlatform = false` (Platform Owner hasn't disabled)
4. Account status is ACTIVE or GRACE (not READ_ONLY or LOCKED)

## Security & Permissions

- All actions verify user membership and role
- Context scoping enforced at database query level
- Approval-required actions cannot bypass confirmation
- Audit trail for all executed actions
- Role hierarchy respected in all operations

## Integration Points

### Billing System
- Uses `requireBillingPermission()` from `lib/billing-state.ts`
- Checks `canUseAI` permission
- Respects account status (ACTIVE, GRACE, READ_ONLY, LOCKED)

### Role System
- Uses `getUserMembership()` from `lib/rbac.ts`
- Respects role definitions from `lib/roles.ts`
- No modifications to core role/permission definitions

## Next Steps (Future Enhancements)

1. **LLM Function Calling**: Replace keyword-based action detection with OpenAI function calling for more accurate intent detection
2. **Structured Output**: Use structured output for action proposals
3. **Usage Analytics Dashboard**: Show usage trends and insights
4. **Configurable Limits**: Allow per-team usage limit configuration
5. **Action Templates**: Pre-defined action templates for common tasks
6. **Batch Approvals**: Allow approving multiple proposals at once

## Testing Checklist

- [ ] Test AI chat with different roles (Head Coach, Coordinator, Position Coach, Player, Parent)
- [ ] Test usage tracking and role weighting
- [ ] Test soft cap behavior (80% threshold)
- [ ] Test hard limit blocking
- [ ] Test approval flow for parent announcements
- [ ] Test approval flow for roster modifications
- [ ] Test AI premium gating (subscription, AI enabled, platform disable)
- [ ] Test billing state integration
- [ ] Test action execution with proper scoping
- [ ] Test error handling for disabled AI

## Notes

- Action detection currently uses keyword-based matching. In production, this should be replaced with LLM function calling or structured output for better accuracy.
- Usage limits are hardcoded to 10,000 tokens. This should be made configurable per team in the future.
- The confirmation UI is basic. Consider adding more detailed previews and selective item confirmation for bulk operations.
