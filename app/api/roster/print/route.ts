import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { buildRosterPrintPayload } from "@/lib/roster/roster-print-payload"

/**
 * GET /api/roster/print?teamId=xxx
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    try {
      await requireTeamAccess(teamId)
    } catch (accessErr: unknown) {
      const msg = accessErr instanceof Error ? accessErr.message : "Access denied"
      if (accessErr instanceof MembershipLookupError) {
        return NextResponse.json({ error: "Failed to verify team access", stage: "access_check" }, { status: 500 })
      }
      if (msg === "Unauthorized") {
        return NextResponse.json({ error: msg }, { status: 401 })
      }
      return NextResponse.json({ error: msg }, { status: 403 })
    }

    const payload = await buildRosterPrintPayload(supabase, teamId)
    if (payload && typeof payload === "object" && "error" in payload && "stage" in payload) {
      const err = payload as { error: string; stage: string }
      const status = err.stage === "team" ? 404 : 500
      return NextResponse.json({ error: err.error, stage: err.stage }, { status })
    }

    return NextResponse.json(payload)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate roster"
    console.error("[GET /api/roster/print]", error)
    return NextResponse.json({ error: message, stage: "unexpected" }, { status: 500 })
  }
}
