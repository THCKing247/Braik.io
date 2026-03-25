import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { computeTeamReadinessPayload } from "@/lib/server/compute-team-readiness"

/**
 * GET /api/teams/[teamId]/readiness?summaryOnly=1
 * Team-wide readiness. Coach only.
 * summaryOnly=1: aggregated counts (RPC) + unstable_cache revalidate 30s per teamId.
 * Full: per-player rows, not cached so roster filters stay fresh after edits.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can view team readiness." }, { status: 403 })
    }

    const summaryOnly = new URL(request.url).searchParams.get("summaryOnly") === "1"

    const body = summaryOnly
      ? await unstable_cache(
          async () => computeTeamReadinessPayload(teamId, true),
          ["braik-team-readiness-summary-v4", teamId],
          { revalidate: 30 }
        )()
      : await computeTeamReadinessPayload(teamId, false)

    return NextResponse.json(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../readiness]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
