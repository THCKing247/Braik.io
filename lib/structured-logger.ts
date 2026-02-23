/**
 * Structured Logging Utility
 * 
 * Provides consistent, structured logging for key actions:
 * - Permission denials
 * - Message send/thread create
 * - Event create/edit/delete
 * - Depth chart edits
 * - Billing state transitions
 * - AI actions + approvals
 * - Admin overrides
 * 
 * Logs are written to console (for development) and can be extended
 * to write to external logging services in production.
 */

export type LogLevel = "info" | "warn" | "error"

export interface LogContext {
  userId?: string
  teamId?: string
  role?: string
  action: string
  metadata?: Record<string, any>
  error?: Error | string
  timestamp?: Date
}

export interface PermissionDenialLog extends LogContext {
  action: "permission_denied"
  requiredPermission?: string
  requiredRole?: string
  reason: string
}

export interface MessageLog extends LogContext {
  action: "message_sent" | "thread_created"
  threadId?: string
  messageId?: string
  participantCount?: number
}

export interface EventLog extends LogContext {
  action: "event_created" | "event_updated" | "event_deleted"
  eventId?: string
  eventType?: string
  title?: string
}

export interface DepthChartLog extends LogContext {
  action: "depth_chart_edited"
  entriesCount?: number
  unit?: string
  position?: string
}

export interface BillingStateLog extends LogContext {
  action: "billing_state_transition"
  fromStatus?: string
  toStatus: string
  reason?: string
}

export interface AIActionLog extends LogContext {
  action: "ai_action_proposed" | "ai_action_approved" | "ai_action_rejected" | "ai_action_executed"
  proposalId?: string
  actionType?: string
  requiresApproval?: boolean
}

export interface AdminOverrideLog extends LogContext {
  action: "admin_override"
  overrideType: string
  targetUserId?: string
  targetTeamId?: string
}

export type StructuredLog =
  | PermissionDenialLog
  | MessageLog
  | EventLog
  | DepthChartLog
  | BillingStateLog
  | AIActionLog
  | AdminOverrideLog

/**
 * Format log entry for consistent output
 */
function formatLogEntry(log: StructuredLog, level: LogLevel): string {
  const timestamp = log.timestamp || new Date()
  const base = {
    timestamp: timestamp.toISOString(),
    level,
    action: log.action,
    userId: log.userId,
    teamId: log.teamId,
    role: log.role,
  }

  // Add action-specific fields
  const actionFields: Record<string, any> = { ...base, ...log.metadata }

  // Add action-specific context
  if (log.action === "permission_denied") {
    actionFields.requiredPermission = (log as PermissionDenialLog).requiredPermission
    actionFields.requiredRole = (log as PermissionDenialLog).requiredRole
    actionFields.reason = (log as PermissionDenialLog).reason
  } else if (log.action === "message_sent" || log.action === "thread_created") {
    actionFields.threadId = (log as MessageLog).threadId
    actionFields.messageId = (log as MessageLog).messageId
    actionFields.participantCount = (log as MessageLog).participantCount
  } else if (log.action.startsWith("event_")) {
    actionFields.eventId = (log as EventLog).eventId
    actionFields.eventType = (log as EventLog).eventType
    actionFields.title = (log as EventLog).title
  } else if (log.action === "depth_chart_edited") {
    actionFields.entriesCount = (log as DepthChartLog).entriesCount
    actionFields.unit = (log as DepthChartLog).unit
    actionFields.position = (log as DepthChartLog).position
  } else if (log.action === "billing_state_transition") {
    actionFields.fromStatus = (log as BillingStateLog).fromStatus
    actionFields.toStatus = (log as BillingStateLog).toStatus
    actionFields.reason = (log as BillingStateLog).reason
  } else if (log.action.startsWith("ai_action_")) {
    actionFields.proposalId = (log as AIActionLog).proposalId
    actionFields.actionType = (log as AIActionLog).actionType
    actionFields.requiresApproval = (log as AIActionLog).requiresApproval
  } else if (log.action === "admin_override") {
    actionFields.overrideType = (log as AdminOverrideLog).overrideType
    actionFields.targetUserId = (log as AdminOverrideLog).targetUserId
    actionFields.targetTeamId = (log as AdminOverrideLog).targetTeamId
  }

  if (log.error) {
    actionFields.error = log.error instanceof Error ? log.error.message : log.error
    if (log.error instanceof Error && log.error.stack) {
      actionFields.stack = log.error.stack
    }
  }

  return JSON.stringify(actionFields, null, 2)
}

/**
 * Write log to console (and potentially external service in production)
 */
function writeLog(log: StructuredLog, level: LogLevel) {
  const formatted = formatLogEntry(log, level)
  
  // Console output for development
  switch (level) {
    case "error":
      console.error(`[${log.action}]`, formatted)
      break
    case "warn":
      console.warn(`[${log.action}]`, formatted)
      break
    default:
      console.log(`[${log.action}]`, formatted)
  }

  // In production, you could also send to external logging service:
  // - CloudWatch, Datadog, Sentry, etc.
  // Example:
  // if (process.env.NODE_ENV === "production") {
  //   await sendToLoggingService(formatted, level)
  // }
}

/**
 * Log permission denial
 */
export function logPermissionDenial(
  context: {
    userId?: string
    teamId?: string
    role?: string
    requiredPermission?: string
    requiredRole?: string
    reason: string
  }
) {
  const log: PermissionDenialLog = {
    action: "permission_denied",
    userId: context.userId,
    teamId: context.teamId,
    role: context.role,
    requiredPermission: context.requiredPermission,
    requiredRole: context.requiredRole,
    reason: context.reason,
    timestamp: new Date(),
  }
  writeLog(log, "warn")
}

/**
 * Log message sent
 */
export function logMessageSent(
  context: {
    userId: string
    teamId: string
    role?: string
    threadId: string
    messageId: string
  }
) {
  const log: MessageLog = {
    action: "message_sent",
    userId: context.userId,
    teamId: context.teamId,
    role: context.role,
    threadId: context.threadId,
    messageId: context.messageId,
    timestamp: new Date(),
  }
  writeLog(log, "info")
}

/**
 * Log thread created
 */
export function logThreadCreated(
  context: {
    userId: string
    teamId: string
    role?: string
    threadId: string
    participantCount: number
  }
) {
  const log: MessageLog = {
    action: "thread_created",
    userId: context.userId,
    teamId: context.teamId,
    role: context.role,
    threadId: context.threadId,
    participantCount: context.participantCount,
    timestamp: new Date(),
  }
  writeLog(log, "info")
}

/**
 * Log event action
 */
export function logEventAction(
  action: "event_created" | "event_updated" | "event_deleted",
  context: {
    userId: string
    teamId: string
    role?: string
    eventId: string
    eventType?: string
    title?: string
  }
) {
  const log: EventLog = {
    action,
    userId: context.userId,
    teamId: context.teamId,
    role: context.role,
    eventId: context.eventId,
    eventType: context.eventType,
    title: context.title,
    timestamp: new Date(),
  }
  writeLog(log, "info")
}

/**
 * Log depth chart edit
 */
export function logDepthChartEdit(
  context: {
    userId: string
    teamId: string
    role?: string
    entriesCount: number
    unit?: string
    position?: string
  }
) {
  const log: DepthChartLog = {
    action: "depth_chart_edited",
    userId: context.userId,
    teamId: context.teamId,
    role: context.role,
    entriesCount: context.entriesCount,
    unit: context.unit,
    position: context.position,
    timestamp: new Date(),
  }
  writeLog(log, "info")
}

/**
 * Log billing state transition
 */
export function logBillingStateTransition(
  context: {
    teamId: string
    fromStatus?: string
    toStatus: string
    reason?: string
    metadata?: Record<string, any>
  }
) {
  const log: BillingStateLog = {
    action: "billing_state_transition",
    teamId: context.teamId,
    fromStatus: context.fromStatus,
    toStatus: context.toStatus,
    reason: context.reason,
    metadata: context.metadata,
    timestamp: new Date(),
  }
  writeLog(log, "info")
}

/**
 * Log AI action
 */
export function logAIAction(
  action: "ai_action_proposed" | "ai_action_approved" | "ai_action_rejected" | "ai_action_executed",
  context: {
    userId: string
    teamId: string
    role?: string
    proposalId?: string
    actionType?: string
    requiresApproval?: boolean
    metadata?: Record<string, any>
  }
) {
  const log: AIActionLog = {
    action,
    userId: context.userId,
    teamId: context.teamId,
    role: context.role,
    proposalId: context.proposalId,
    actionType: context.actionType,
    requiresApproval: context.requiresApproval,
    metadata: context.metadata,
    timestamp: new Date(),
  }
  writeLog(log, "info")
}

/**
 * Log admin override
 */
export function logAdminOverride(
  context: {
    adminUserId: string
    overrideType: string
    targetUserId?: string
    targetTeamId?: string
    metadata?: Record<string, any>
  }
) {
  const log: AdminOverrideLog = {
    action: "admin_override",
    userId: context.adminUserId,
    teamId: context.targetTeamId,
    overrideType: context.overrideType,
    targetUserId: context.targetUserId,
    targetTeamId: context.targetTeamId,
    metadata: context.metadata,
    timestamp: new Date(),
  }
  writeLog(log, "warn")
}
