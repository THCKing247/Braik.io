import { NextResponse } from "next/server"
import { applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { loadAdTeamsTableForRequest } from "@/lib/ad/load-ad-teams-table-for-request"

export const runtime = "nodejs"

/** Browser cache for the signed-in user’s team list (not `public` — rows are account-specific). */
const TEAMS_TABLE_CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=120"

export async function GET() {
  try {
    const result = await loadAdTeamsTableForRequest()
    if (!result.ok) {
      if (result.kind === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      if (result.kind === "forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.json({ error: "Failed to load teams" }, { status: 500 })
    }

    const res = NextResponse.json({ teams: result.teams })
    res.headers.set("Cache-Control", TEAMS_TABLE_CACHE_CONTROL)
    if (result.refreshedSession) applyRefreshedSessionCookies(res, result.refreshedSession)
    return res
  } catch (err) {
    console.error("[GET /api/ad/pages/teams-table]", err)
    return NextResponse.json({ error: "Failed to load teams" }, { status: 500 })
  }
}
