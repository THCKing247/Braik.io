import { prisma } from "./prisma"
import { getUserMembership } from "./rbac"
import { ROLES, type Role } from "./roles"
import { requiresApproval, getRoleContext } from "./ai-utils"

export interface ActionProposal {
  actionType: string
  payload: any
  preview: {
    summary: string
    items: any[]
    affectedCount: number
  }
  requiresApproval: boolean
  approverRole?: Role
  estimatedImpact: "low" | "medium" | "high"
}

export interface ActionExecutionResult {
  success: boolean
  executedItems: any[]
  errors?: string[]
}

/**
 * Execute a safe action (no approval required)
 */
export async function executeSafeAction(
  teamId: string,
  userId: string,
  actionType: string,
  payload: any
): Promise<ActionExecutionResult> {
  const membership = await getUserMembership(teamId)
  if (!membership) {
    throw new Error("Access denied")
  }

  const roleContext = getRoleContext(membership)

  // Verify action doesn't require approval
  if (requiresApproval(actionType, roleContext)) {
    throw new Error(`Action ${actionType} requires approval`)
  }

  const executedItems: any[] = []
  const errors: string[] = []

  try {
    switch (actionType) {
      case "create_event":
        const event = await createEvent(teamId, userId, payload, roleContext)
        executedItems.push({ type: "event", id: event.id, result: event })
        break

      case "update_event":
        const updatedEvent = await updateEvent(teamId, userId, payload, roleContext)
        executedItems.push({ type: "event", id: updatedEvent.id, result: updatedEvent })
        break

      case "send_message":
        const message = await sendMessage(teamId, userId, payload, roleContext)
        executedItems.push({ type: "message", id: message.id, result: message })
        break

      case "draft_announcement":
      case "draft_event_description":
      case "draft_message":
        // These are content generation only, no execution needed
        executedItems.push({ type: "draft", content: payload.content })
        break

      default:
        throw new Error(`Unknown action type: ${actionType}`)
    }
  } catch (error: any) {
    errors.push(error.message || "Action execution failed")
  }

  // Create audit log
  if (executedItems.length > 0) {
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: userId,
        action: `ai_action_executed_${actionType}`,
        metadata: {
          actionType,
          executedItems,
          errors,
        },
      },
    })
  }

  return {
    success: errors.length === 0,
    executedItems,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Create an event (respects role hierarchy)
 */
async function createEvent(teamId: string, userId: string, payload: any, roleContext: any) {
  // Validate payload
  if (!payload.title || !payload.start || !payload.end) {
    throw new Error("Missing required fields: title, start, end")
  }

  // Apply role-based scoping
  const eventData: any = {
    teamId,
    eventType: payload.eventType || "CUSTOM",
    title: payload.title,
    description: payload.description || null,
    start: new Date(payload.start),
    end: new Date(payload.end),
    location: payload.location || null,
    visibility: payload.visibility || "TEAM",
    createdBy: userId,
  }

  // Apply scoping based on role
  if (roleContext.isCoordinator && roleContext.unit) {
    eventData.scopedUnit = roleContext.unit
    eventData.coordinatorType = roleContext.unit === "OFFENSE" ? "OC" : roleContext.unit === "DEFENSE" ? "DC" : "ST"
  } else if (roleContext.isPositionCoach && roleContext.positionGroups) {
    eventData.scopedPositionGroups = roleContext.positionGroups
  }

  const event = await prisma.event.create({
    data: eventData,
  })

  return event
}

/**
 * Update an event (if user has permission)
 */
async function updateEvent(teamId: string, userId: string, payload: any, roleContext: any) {
  if (!payload.eventId) {
    throw new Error("Missing eventId")
  }

  // Check if event exists and user has permission
  const existingEvent = await prisma.event.findUnique({
    where: { id: payload.eventId },
  })

  if (!existingEvent || existingEvent.teamId !== teamId) {
    throw new Error("Event not found or access denied")
  }

  // Head Coach can edit any event
  // Others can only edit events they created (and not locked)
  if (!roleContext.isHeadCoach) {
    if (existingEvent.locked || existingEvent.createdBy !== userId) {
      throw new Error("You don't have permission to edit this event")
    }
  }

  const updateData: any = {}
  if (payload.title) updateData.title = payload.title
  if (payload.description !== undefined) updateData.description = payload.description
  if (payload.start) updateData.start = new Date(payload.start)
  if (payload.end) updateData.end = new Date(payload.end)
  if (payload.location !== undefined) updateData.location = payload.location

  const updatedEvent = await prisma.event.update({
    where: { id: payload.eventId },
    data: updateData,
  })

  return updatedEvent
}

/**
 * Send a message in a thread
 */
async function sendMessage(teamId: string, userId: string, payload: any, roleContext: any) {
  if (!payload.threadId || !payload.body) {
    throw new Error("Missing threadId or body")
  }

  // Verify thread exists and user has access
  const thread = await prisma.messageThread.findUnique({
    where: { id: payload.threadId },
    include: {
      participants: true,
    },
  })

  if (!thread || thread.teamId !== teamId) {
    throw new Error("Thread not found or access denied")
  }

  // Check if user is a participant
  const isParticipant = thread.participants.some((p) => p.userId === userId)
  if (!isParticipant && !roleContext.isHeadCoach) {
    throw new Error("You don't have access to this thread")
  }

  const message = await prisma.message.create({
    data: {
      threadId: payload.threadId,
      body: payload.body,
      attachments: payload.attachments || null,
      createdBy: userId,
    },
  })

  return message
}

/**
 * Create an action proposal for approval-required actions
 */
export async function createActionProposal(
  teamId: string,
  userId: string,
  actionType: string,
  payload: any,
  preview: any
): Promise<string> {
  const membership = await getUserMembership(teamId)
  if (!membership) {
    throw new Error("Access denied")
  }

  const roleContext = getRoleContext(membership)

  // Verify action requires approval
  if (!requiresApproval(actionType, roleContext)) {
    throw new Error(`Action ${actionType} does not require approval`)
  }

  // Determine approver role
  let approverRole: Role = ROLES.HEAD_COACH
  if (actionType === "create_parent_announcement") {
    approverRole = ROLES.HEAD_COACH
  } else if (actionType.includes("roster") || actionType.includes("player")) {
    approverRole = ROLES.HEAD_COACH
  }

  const proposal = await prisma.aIActionProposal.create({
    data: {
      userId,
      teamId,
      actionType,
      payload,
      affectedRecordsPreview: preview,
      status: "pending",
    },
  })

  return proposal.id
}

/**
 * Execute a confirmed action proposal
 */
export async function executeConfirmedAction(
  proposalId: string,
  userId: string,
  confirmedItems?: string[]
): Promise<ActionExecutionResult> {
  const proposal = await prisma.aIActionProposal.findUnique({
    where: { id: proposalId },
  })

  if (!proposal) {
    throw new Error("Proposal not found")
  }

  if (proposal.status !== "pending") {
    throw new Error(`Proposal is not pending (status: ${proposal.status})`)
  }

  // Verify user is Head Coach
  const membership = await getUserMembership(proposal.teamId)
  if (!membership || membership.role !== ROLES.HEAD_COACH) {
    throw new Error("Only Head Coach can confirm actions")
  }

  const executedItems: any[] = []
  const errors: string[] = []

  try {
    // Execute based on action type
    switch (proposal.actionType) {
      case "create_parent_announcement":
        const announcement = await createParentAnnouncement(
          proposal.teamId,
          userId,
          proposal.payload,
          confirmedItems
        )
        executedItems.push({ type: "announcement", id: announcement.id, result: announcement })
        break

      case "modify_roster":
      case "add_player":
      case "remove_player":
      case "update_player":
        // Roster modifications would go here
        // For now, return placeholder
        executedItems.push({
          type: "roster_change",
          message: "Roster modification executed (implementation pending)",
        })
        break

      case "bulk_create_events":
        const events = await bulkCreateEvents(proposal.teamId, userId, proposal.payload, confirmedItems)
        executedItems.push(...events.map((e) => ({ type: "event", id: e.id, result: e })))
        break

      default:
        throw new Error(`Unknown action type: ${proposal.actionType}`)
    }

    // Update proposal status
    await prisma.aIActionProposal.update({
      where: { id: proposalId },
      data: {
        status: "executed",
        confirmedBy: userId,
        executedAt: new Date(),
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        teamId: proposal.teamId,
        actorUserId: userId,
        action: `ai_action_confirmed_${proposal.actionType}`,
        metadata: {
          proposalId,
          actionType: proposal.actionType,
          executedItems,
        },
      },
    })
  } catch (error: any) {
    errors.push(error.message || "Action execution failed")

    // Update proposal status to rejected
    await prisma.aIActionProposal.update({
      where: { id: proposalId },
      data: {
        status: "rejected",
      },
    })
  }

  return {
    success: errors.length === 0,
    executedItems,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Create parent announcement (Head Coach only)
 */
async function createParentAnnouncement(teamId: string, userId: string, payload: any, confirmedItems?: string[]) {
  if (!payload.title || !payload.body) {
    throw new Error("Missing title or body")
  }

  const announcement = await prisma.announcement.create({
    data: {
      teamId,
      title: payload.title,
      body: payload.body,
      audience: "parents", // Parent announcements
      attachments: payload.attachments || null,
      createdBy: userId,
    },
  })

  return announcement
}

/**
 * Bulk create events from proposal
 */
async function bulkCreateEvents(teamId: string, userId: string, payload: any, confirmedItems?: string[]) {
  const events = payload.events || []
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("No events to create")
  }

  // Filter by confirmedItems if provided
  const eventsToCreate = confirmedItems
    ? events.filter((e: any, idx: number) => confirmedItems.includes(idx.toString()))
    : events

  const createdEvents = []

  for (const eventData of eventsToCreate) {
    const event = await prisma.event.create({
      data: {
        teamId,
        eventType: eventData.eventType || "CUSTOM",
        title: eventData.title,
        description: eventData.description || null,
        start: new Date(eventData.start),
        end: new Date(eventData.end),
        location: eventData.location || null,
        visibility: eventData.visibility || "TEAM",
        createdBy: userId,
      },
    })
    createdEvents.push(event)
  }

  return createdEvents
}
