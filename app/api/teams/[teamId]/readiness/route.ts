import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { computeTeamReadinessPayload } from "@/lib/server/compute-team-readiness"

/**
 * GET /api/teams/[teamId]/readiness?summaryOnly=1
 * Team-wide readiness. Coach only.
 * summaryOnly=1 returns { summary } only (fast; cached ~45s). Full response includes per-player rows for roster tab.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can view team readiness." }, { status: 403 })
    }

    const summaryOnly = new URL(request.url).searchParams.get("summaryOnly") === "1"

    // Cache dashboard-style summary only; full payload powers roster filters and should reflect edits immediately.
    const body = summaryOnly
      ? await unstable_cache(
          async () => computeTeamReadinessPayload(teamId, true),
          ["braik-team-readiness-summary-v1", teamId],
          { revalidate: 45 }
        )()
      : await computeTeamReadinessPayload(teamId, false)

    return NextResponse.json(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../readiness]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
