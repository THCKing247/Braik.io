import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { createNotifications } from "@/lib/notifications"
import { requireBillingPermission } from "@/lib/billing-state"
import { executeConfirmedAction } from "@/lib/ai-actions"
import { ROLES } from "@/lib/roles"
import { logAIAction, logPermissionDenial } from "@/lib/structured-logger"

// POST /api/ai/confirm-action
// Executes a confirmed AI action proposal
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { proposalId, confirmedItems, notes } = body

    if (!proposalId) {
      return NextResponse.json(
        { error: "Proposal ID is required" },
        { status: 400 }
      )
    }

    // Get proposal
    const proposal = await prisma.aIActionProposal.findUnique({
      where: { id: proposalId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Verify user has access
    const membership = await getUserMembership(proposal.teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check billing state
    await requireBillingPermission(proposal.teamId, "useAI", prisma)

    // Only Head Coach can confirm actions
    if (membership.role !== ROLES.HEAD_COACH) {
      logPermissionDenial({
        reason: "Only Head Coach can confirm AI actions",
        userId: session.user.id,
        teamId: proposal.teamId,
        role: membership.role,
      })
      return NextResponse.json(
        { error: "Only Head Coach can confirm AI actions" },
        { status: 403 }
      )
    }

    // Execute the confirmed action
    const result = await executeConfirmedAction(proposalId, session.user.id, confirmedItems)

    if (!result.success) {
      // Log rejection if execution failed
      logAIAction("ai_action_rejected", {
        userId: session.user.id,
        teamId: proposal.teamId,
        role: membership.role,
        proposalId,
        actionType: proposal.actionType,
        metadata: { errors: result.errors },
      })
      return NextResponse.json(
        {
          success: false,
          error: "action_execution_failed",
          message: "Failed to execute action",
          errors: result.errors,
        },
        { status: 500 }
      )
    }

    // Log successful approval and execution
    logAIAction("ai_action_approved", {
      userId: session.user.id,
      teamId: proposal.teamId,
      role: membership.role,
      proposalId,
      actionType: proposal.actionType,
    })
    logAIAction("ai_action_executed", {
      userId: session.user.id,
      teamId: proposal.teamId,
      role: membership.role,
      proposalId,
      actionType: proposal.actionType,
      metadata: { executedItemsCount: result.executedItems?.length || 0 },
    })

    // Notify the user who created the AI proposal that it's been completed
    // Only notify if the creator is different from the executor
    if (proposal.userId !== session.user.id) {
      await createNotifications({
        type: "ai_task_completed",
        teamId: proposal.teamId,
        title: `AI task completed: ${proposal.actionType}`,
        body: `Your AI action proposal has been executed successfully.`,
        linkUrl: `/dashboard/ai-assistant`,
        linkType: "ai",
        linkId: proposalId,
        metadata: {
          proposalId,
          actionType: proposal.actionType,
          executedItems: result.executedItems,
        },
        targetUserIds: [proposal.userId], // Notify the proposal creator
      })
    }

    return NextResponse.json({
      success: true,
      executedItems: result.executedItems,
      message: "Action executed successfully",
      proposal: {
        id: proposal.id,
        actionType: proposal.actionType,
        status: "executed",
      },
    })
  } catch (error: any) {
    console.error("Confirm action error:", error)

    // Handle billing permission errors
    if (error.message?.includes("Action not allowed")) {
      return NextResponse.json(
        {
          success: false,
          error: "billing_restriction",
          message: error.message,
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { success: false, error: "internal_error", message: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/ai/confirm-action?proposalId=xxx
// Get proposal details for review
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const proposalId = searchParams.get("proposalId")

    if (!proposalId) {
      return NextResponse.json(
        { error: "Proposal ID is required" },
        { status: 400 }
      )
    }

    // Get proposal
    const proposal = await prisma.aIActionProposal.findUnique({
      where: { id: proposalId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Verify user has access
    const membership = await getUserMembership(proposal.teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only Head Coach can view proposals for confirmation
    if (membership.role !== ROLES.HEAD_COACH) {
      return NextResponse.json(
        { error: "Only Head Coach can view action proposals" },
        { status: 403 }
      )
    }

    return NextResponse.json({
      proposal: {
        id: proposal.id,
        actionType: proposal.actionType,
        payload: proposal.payload,
        preview: proposal.affectedRecordsPreview,
        status: proposal.status,
        createdAt: proposal.createdAt,
        createdBy: {
          name: proposal.user.name,
          email: proposal.user.email,
        },
      },
    })
  } catch (error: any) {
    console.error("Get proposal error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
