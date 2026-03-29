import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { loadAdTeamsPageRows } from "@/lib/ad/load-ad-teams-page-rows"

export const runtime = "nodejs"

export async function GET() {
  try {
    const sessionResult = await getRequestUserLite()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const u = sessionResult.user
    const supabase = getSupabaseServer()

    try {
      const teams = await loadAdTeamsPageRows(supabase, {
        id: u.id,
        email: u.email,
        role: u.role ?? "",
        isPlatformOwner: u.isPlatformOwner === true,
      })
      const res = NextResponse.json({ teams })
      if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
      return res
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === "AD_BOOTSTRAP_FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      throw err
    }
  } catch (err) {
    console.error("[GET /api/ad/pages/teams-table]", err)
    return NextResponse.json({ error: "Failed to load teams" }, { status: 500 })
  }
}
