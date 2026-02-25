import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { LEGAL_POLICY_VERSIONS } from "@/lib/compliance-config"
import { logComplianceEvent } from "@/lib/compliance-log"
import { getRequestIp } from "@/lib/request-ip"
import { getActiveImpersonationFromToken, getSupportTokenFromRequestCookieHeader } from "@/lib/impersonation"

// POST /api/teams/[teamId]/payments/coach/connect
// This initiates the connection flow for a payment provider (e.g., Stripe Connect)
export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = params
    const supportToken = getSupportTokenFromRequestCookieHeader(request.headers.get("cookie"))
    const impersonation = await getActiveImpersonationFromToken(supportToken)
    if (impersonation) {
      return NextResponse.json(
        { error: "Bank/payout changes are blocked during support impersonation sessions" },
        { status: 403 }
      )
    }

    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only head coach can connect payment accounts
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json(
        { error: "Only head coaches can connect payment accounts" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { provider, paymentAckAccepted, paymentAckVersion } = body

    if (!provider) {
      return NextResponse.json({ error: "Provider is required" }, { status: 400 })
    }
    if (!paymentAckAccepted) {
      return NextResponse.json(
        { error: "Payment activation acknowledgment is required" },
        { status: 400 }
      )
    }

    // Check if account already exists
    const existingAccount = await prisma.coachPaymentAccount.findUnique({
      where: { teamId },
    })

    if (existingAccount && existingAccount.status === "connected") {
      return NextResponse.json(
        { error: "Payment account already connected" },
        { status: 400 }
      )
    }

    // In a real implementation, this would:
    // 1. Create a Stripe Connect account or similar
    // 2. Generate an onboarding link
    // 3. Return the link for the coach to complete setup
    // For now, we'll create a placeholder account

    const account = await prisma.coachPaymentAccount.upsert({
      where: { teamId },
      update: {
        provider,
        status: "pending",
      },
      create: {
        teamId,
        provider,
        connectedAccountId: `placeholder_${Date.now()}`,
        status: "pending",
      },
    })

    // In production, you would return a Stripe Connect onboarding URL here
    // For now, return a mock onboarding URL
    const onboardingUrl = `/dashboard/payments/coach/complete?accountId=${account.id}`

    await logComplianceEvent({
      userId: session.user.id,
      role: membership.role,
      eventType: "payment_activation_acknowledgement",
      policyVersion: paymentAckVersion || LEGAL_POLICY_VERSIONS.paymentAcknowledgement,
      ipAddress: getRequestIp(request),
      metadata: {
        provider,
        teamId,
      },
    })

    return NextResponse.json({
      account,
      onboardingUrl,
      message: "Complete the onboarding process to connect your payment account",
    })
  } catch (error: any) {
    console.error("Connect payment account error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
