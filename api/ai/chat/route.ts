import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { requireBillingPermission } from "@/lib/billing-state"
import {
  isAIEnabled,
  getAIUsageStatus,
  recordAIUsage,
  buildRoleScopedContext,
  getRoleContext,
  requiresApproval,
  getRoleWeight,
} from "@/lib/ai-utils"
import { executeSafeAction, createActionProposal } from "@/lib/ai-actions"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Default usage limit (can be made configurable per team)
const DEFAULT_USAGE_LIMIT = 10000

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, message, conversationHistory } = await request.json()

    if (!teamId || !message) {
      return NextResponse.json({ error: "Team ID and message are required" }, { status: 400 })
    }

    // Verify user has access to team
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check billing state - AI is always premium and requires active/grace status
    const billingState = await requireBillingPermission(teamId, "useAI", prisma)

    // Check if AI is enabled for this team
    const aiStatus = await isAIEnabled(teamId)
    if (!aiStatus.enabled) {
      return NextResponse.json(
        {
          type: "error",
          error: "ai_disabled",
          message: getAIDisabledMessage(aiStatus.reason),
          reason: aiStatus.reason,
        },
        { status: 403 }
      )
    }

    // Get team context
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        _count: {
          select: {
            players: true,
            events: true,
            announcements: true,
          },
        },
      },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Get usage status
    const usageStatus = await getAIUsageStatus(teamId, DEFAULT_USAGE_LIMIT)

    // Check if at limit
    if (usageStatus.mode === "disabled") {
      return NextResponse.json({
        type: "error",
        error: "usage_limit_reached",
        message: "AI usage limit reached. Please contact support to upgrade.",
        currentUsage: usageStatus.tokensUsed,
        limit: usageStatus.tokensLimit,
      })
    }

    // Get role context
    const roleContext = getRoleContext(membership)

    // Build role-scoped context
    const roleScopedContext = buildRoleScopedContext(roleContext, {
      name: team.name,
      sport: team.sport,
      seasonName: team.seasonName,
    })

    // Get recent events for context
    const recentEvents = await prisma.event.findMany({
      where: { teamId },
      orderBy: { start: "asc" },
      take: 10,
    })

    // Build system prompt
    let systemPrompt = `${roleScopedContext}

Recent events:
${recentEvents.map((e: { title: string; start: Date }) => `- ${e.title} on ${new Date(e.start).toLocaleDateString()}`).join("\n")}

Team stats:
- Players: ${team._count.players}
- Events: ${team._count.events}
- Announcements: ${team._count.announcements}

AI Usage Status:
- Tokens used: ${usageStatus.tokensUsed} / ${usageStatus.tokensLimit} (${usageStatus.usagePercentage.toFixed(1)}%)
- Mode: ${usageStatus.mode === "suggestion_only" ? "Suggestion-only (near limit)" : "Full access"}

When the user requests an action:
1. If it's a question, answer directly
2. If it's a safe action (create event, send message, draft content), you can propose executing it
3. If it requires approval (parent announcement, roster change), you MUST create a proposal and request confirmation
4. Always respect role permissions and hierarchy

Available actions:
- create_event: Create a calendar event (respects role scoping)
- update_event: Update an existing event (if user has permission)
- send_message: Send a message in a thread
- draft_announcement: Generate announcement text (no execution)
- draft_event_description: Generate event description (no execution)
- draft_message: Generate message text (no execution)
- create_parent_announcement: Create announcement to parents (REQUIRES APPROVAL, Head Coach only)
- modify_roster: Modify roster (REQUIRES APPROVAL, Head Coach only)

Be helpful, concise, and coach-friendly.`

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return helpful responses without OpenAI
      return handleWithoutOpenAI(message, team, recentEvents, usageStatus)
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...(conversationHistory || []),
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that."
    const tokensUsed = completion.usage?.total_tokens || 0

    // Record usage
    const usageRecord = await recordAIUsage(teamId, session.user.id, membership.role, tokensUsed, "chat")

    // Detect if response contains action intent
    // In production, use structured output or function calling
    const actionIntent = detectActionIntent(message, response, roleContext)

    // If action detected, handle accordingly
    if (actionIntent) {
      return await handleActionIntent(actionIntent, teamId, session.user.id, membership, roleContext, usageRecord)
    }

    // Save conversation
    await saveConversation(teamId, session.user.id, membership.role, message, response, conversationHistory)

    // Return response
    return NextResponse.json({
      type: "response",
      response,
      usage: {
        tokensUsed: usageRecord.tokensUsed,
        rawTokens: usageRecord.rawTokens,
        roleWeight: usageRecord.roleWeight,
      },
      usageStatus: {
        tokensUsed: usageStatus.tokensUsed + usageRecord.tokensUsed,
        tokensLimit: usageStatus.tokensLimit,
        usagePercentage: ((usageStatus.tokensUsed + usageRecord.tokensUsed) / usageStatus.tokensLimit) * 100,
        mode: usageStatus.mode,
      },
    })
  } catch (error: any) {
    console.error("AI chat error:", error)

    // If OpenAI API key is missing or invalid, return a helpful message
    if (error.message?.includes("API key") || !process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        type: "response",
        response: "AI features are ready but not fully configured. Add your OPENAI_API_KEY to enable advanced AI capabilities.",
      })
    }

    return NextResponse.json(
      { type: "error", error: "internal_error", message: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Handle requests without OpenAI (fallback mode)
 */
function handleWithoutOpenAI(
  message: string,
  team: any,
  recentEvents: any[],
  usageStatus: any
): NextResponse {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes("schedule") || lowerMessage.includes("practice") || lowerMessage.includes("game")) {
    return NextResponse.json({
      type: "response",
      response: `I can help you with schedule questions! You have ${recentEvents.length} upcoming events. The next event is "${recentEvents[0]?.title || "none"}" on ${recentEvents[0] ? new Date(recentEvents[0].start).toLocaleDateString() : "N/A"}. To enable full AI capabilities, add your OPENAI_API_KEY to your environment variables.`,
    })
  }

  if (lowerMessage.includes("roster") || lowerMessage.includes("player")) {
    return NextResponse.json({
      type: "response",
      response: `Your team has ${team._count.players} players. To enable full AI capabilities for roster management, add your OPENAI_API_KEY to your environment variables.`,
    })
  }

  return NextResponse.json({
    type: "response",
    response: "AI features are ready but not fully configured. Add your OPENAI_API_KEY to enable advanced AI capabilities. I can still help with basic questions about your team!",
  })
}

/**
 * Detect action intent from user message and AI response
 * In production, use OpenAI function calling or structured output
 */
function detectActionIntent(message: string, response: string, roleContext: any): any | null {
  const lowerMessage = message.toLowerCase()
  const lowerResponse = response.toLowerCase()

  // Simple keyword-based detection (in production, use LLM function calling)
  if (lowerMessage.includes("create event") || lowerMessage.includes("schedule") || lowerMessage.includes("add practice")) {
    return { type: "create_event", requiresApproval: false }
  }

  if (lowerMessage.includes("send announcement to parents") || lowerMessage.includes("parent announcement")) {
    return { type: "create_parent_announcement", requiresApproval: true }
  }

  if (lowerMessage.includes("add player") || lowerMessage.includes("remove player") || lowerMessage.includes("update roster")) {
    return { type: "modify_roster", requiresApproval: true }
  }

  if (lowerMessage.includes("draft") && (lowerMessage.includes("announcement") || lowerMessage.includes("message"))) {
    return { type: "draft_content", requiresApproval: false }
  }

  return null
}

/**
 * Handle action intent
 */
async function handleActionIntent(
  actionIntent: any,
  teamId: string,
  userId: string,
  membership: any,
  roleContext: any,
  usageRecord: any
): Promise<NextResponse> {
  try {
    // Check if action requires approval
    const needsApproval = requiresApproval(actionIntent.type, roleContext)

    if (needsApproval) {
      // Create proposal
      const proposalId = await createActionProposal(teamId, userId, actionIntent.type, {}, {
        summary: `AI detected action: ${actionIntent.type}`,
        items: [],
        affectedCount: 0,
      })

      return NextResponse.json({
        type: "action_proposal",
        proposalId,
        actionType: actionIntent.type,
        preview: {
          summary: `This action requires Head Coach approval`,
          items: [],
          affectedCount: 0,
        },
        requiresApproval: true,
        approverRole: "HEAD_COACH",
        message: "This action requires approval. A proposal has been created for review.",
      })
    } else {
      // For now, return suggestion (in production, would execute safe actions)
      return NextResponse.json({
        type: "action_suggestion",
        actionType: actionIntent.type,
        message: `I can help you ${actionIntent.type}. Please provide more details, or I can draft the content for you.`,
      })
    }
  } catch (error: any) {
    return NextResponse.json({
      type: "error",
      error: "action_error",
      message: error.message || "Failed to process action",
    })
  }
}

/**
 * Save conversation to database
 */
async function saveConversation(
  teamId: string,
  userId: string,
  role: string,
  userMessage: string,
  assistantMessage: string,
  history: any[]
) {
  try {
    // Find or create conversation
    const existing = await prisma.aIConversation.findFirst({
      where: {
        userId,
        teamId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    const messages = [
      ...(existing ? (existing.messages as any[]) : []),
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantMessage },
    ]

    if (existing) {
      await prisma.aIConversation.update({
        where: { id: existing.id },
        data: {
          messages,
          updatedAt: new Date(),
        },
      })
    } else {
      await prisma.aIConversation.create({
        data: {
          userId,
          teamId,
          role,
          messages,
        },
      })
    }
  } catch (error) {
    console.error("Failed to save conversation:", error)
    // Don't fail the request if conversation save fails
  }
}

/**
 * Get user-friendly message for AI disabled reasons
 */
function getAIDisabledMessage(reason?: string): string {
  switch (reason) {
    case "platform_disabled":
      return "AI features have been disabled by the platform administrator."
    case "subscription_required":
      return "AI features require a paid subscription. Please complete your subscription payment."
    case "ai_premium_required":
      return "AI is a premium feature. Please purchase AI access for this season."
    case "account_locked":
      return "Your account is locked. Please contact support."
    default:
      return "AI features are not available for this program."
  }
}
