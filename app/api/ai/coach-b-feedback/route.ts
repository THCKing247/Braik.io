import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { canUseCoachB, type Role } from "@/lib/auth/roles"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

/**
 * POST /api/ai/coach-b-feedback — thumbs / helpfulness only (no prompt text).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as {
      teamId?: string
      helpful?: boolean
      featureArea?: string
    } | null

    const teamId = typeof body?.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : ""
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const { membership } = await requireTeamAccess(teamId)
    if (!canUseCoachB(membership.role as Role)) {
      return NextResponse.json({ error: "Not allowed for this role" }, { status: 403 })
    }

    if (typeof body?.helpful !== "boolean") {
      return NextResponse.json({ error: "helpful (boolean) is required" }, { status: 400 })
    }

    const featureArea =
      typeof body?.featureArea === "string" ? body.featureArea.trim().slice(0, 64) : "chat_widget"

    trackProductEventServer({
      eventName: BRAIK_EVENTS.coach_b.helpfulness,
      eventCategory: "coach_b",
      userId: session.user.id,
      teamId,
      role: membership.role,
      metadata: { helpful: body.helpful, feature_area: featureArea },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify team access" }, { status: 500 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("[POST /api/ai/coach-b-feedback]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
