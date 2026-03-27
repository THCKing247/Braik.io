import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { computeTeamReadinessPayload } from "@/lib/server/compute-team-readiness"
import {
  lightweightCached,
  LW_TTL_READINESS_SUMMARY,
  tagTeamDashboardBootstrap,
  tagTeamReadinessSummary,
} from "@/lib/cache/lightweight-get-cache"

/**
 * GET /api/teams/[teamId]/readiness?summaryOnly=1
 * Team-wide readiness. Coach only.
 * summaryOnly=1: aggregated counts (RPC) + short-lived Data Cache per teamId (tags align with dashboard bootstrap).
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
      ? await lightweightCached(
          ["braik-team-readiness-summary-v4", teamId],
          {
            revalidate: LW_TTL_READINESS_SUMMARY,
            tags: [tagTeamReadinessSummary(teamId), tagTeamDashboardBootstrap(teamId)],
          },
          () => computeTeamReadinessPayload(teamId, true)
        )
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
