import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { loadAdTeamEditPayload } from "@/lib/ad/load-ad-team-edit-payload"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const teamId = new URL(request.url).searchParams.get("teamId")?.trim()
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const sessionResult = await getRequestUserLite()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const u = sessionResult.user
    const supabase = getSupabaseServer()

    const payload = await loadAdTeamEditPayload(supabase, u.id, teamId, u.role)
    const res =
      payload.kind === "redirect"
        ? NextResponse.json({ redirectTo: payload.to })
        : NextResponse.json({ data: payload })

    if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    return res
  } catch (err) {
    console.error("[GET /api/ad/pages/team-edit]", err)
    return NextResponse.json({ error: "Failed to load team" }, { status: 500 })
  }
}
