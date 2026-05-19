import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { loadPlaybookWorkspace } from "@/lib/playbooks/load-playbook-workspace"
import { withApiDevLogging } from "@/lib/api/core/api-dev-log"

/**
 * GET /api/playbooks/[playbookId]/workspace?teamId=
 * Batched first-paint payload: playbook, formations, plays, sub-formations.
 */
async function getHandler(
  request: Request,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params
    const teamId = new URL(request.url).searchParams.get("teamId")?.trim()
    if (!playbookId) {
      return NextResponse.json({ error: "playbookId is required" }, { status: 400 })
    }
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)
    const payload = await loadPlaybookWorkspace(playbookId, teamId)
    if (!payload) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 })
    }

    const res = NextResponse.json(payload)
    res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120")
    return res
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load playbook workspace"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[GET /api/playbooks/[playbookId]/workspace]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const GET = withApiDevLogging("GET /api/playbooks/[playbookId]/workspace", getHandler)
