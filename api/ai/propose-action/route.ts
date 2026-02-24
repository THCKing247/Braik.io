import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { requireBillingPermission } from "@/lib/billing-state"
import { logAIAction, logPermissionDenial } from "@/lib/structured-logger"
import { requiresApproval, getRoleContext } from "@/lib/ai-utils"

// POST /api/ai/propose-action
// AI proposes an action (e.g., creating events from uploaded file)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { teamId, attachmentId, actionType, extractedData } = body

    if (!teamId || !actionType) {
      return NextResponse.json(
        { error: "Team ID and action type are required" },
        { status: 400 }
      )
    }

    // Verify user has access
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only coaches can propose actions
    if (membership.role !== "HEAD_COACH" && membership.role !== "ASSISTANT_COACH") {
      logPermissionDenial({
        reason: "Only coaches can propose AI actions",
        userId: session.user.id,
        teamId,
        role: membership.role,
      })
      return NextResponse.json(
        { error: "Only coaches can propose AI actions" },
        { status: 403 }
      )
    }

    // Check billing state - AI is always premium
    await requireBillingPermission(teamId, "useAI", prisma)

    // Get team to check AI flags
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { aiEnabled: true, aiDisabledByPlatform: true },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    if (!team.aiEnabled) {
      return NextResponse.json(
        { error: "AI premium feature is not enabled for this season. Please purchase AI access." },
        { status: 403 }
      )
    }

    if (team.aiDisabledByPlatform) {
      return NextResponse.json(
        { error: "AI access has been disabled by Platform Owner. Please contact support." },
        { status: 403 }
      )
    }

    // In production, this would:
    // 1. Use AI to analyze extractedData
    // 2. Generate structured action proposals (events, announcements, etc.)
    // 3. Create preview of what will be created/changed
    // For now, return a placeholder proposal

    const proposal = await prisma.aIActionProposal.create({
      data: {
        userId: session.user.id,
        teamId,
        actionType,
        payload: {
          extractedData,
          attachmentId: attachmentId || null,
        },
        affectedRecordsPreview: {
          message: "AI action proposal created. Full parsing will be available when OpenAI is configured.",
          items: [],
        },
        status: "pending",
      },
    })

    // Log AI action proposal
    const roleContext = getRoleContext(membership)
    const needsApproval = requiresApproval(actionType, roleContext)
    logAIAction("ai_action_proposed", {
      userId: session.user.id,
      teamId,
      role: membership.role,
      proposalId: proposal.id,
      actionType,
      requiresApproval: needsApproval,
    })

    return NextResponse.json({
      proposalId: proposal.id,
      actionType,
      preview: proposal.affectedRecordsPreview,
      message: "Action proposal created. Review and confirm to execute.",
    })
  } catch (error: any) {
    console.error("Propose action error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
