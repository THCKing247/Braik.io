import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"

// GET /api/teams/[teamId]/payments/coach/status
export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only head coach can view payment account status
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const account = await prisma.coachPaymentAccount.findUnique({
      where: { teamId },
    })

    if (!account) {
      return NextResponse.json({
        connected: false,
        status: "not_connected",
      })
    }

    return NextResponse.json({
      connected: account.status === "connected",
      status: account.status,
      provider: account.provider,
      account,
    })
  } catch (error: any) {
    console.error("Get payment status error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
