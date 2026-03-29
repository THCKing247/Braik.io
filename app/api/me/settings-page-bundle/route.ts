import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { fetchSettingsPageBundle } from "@/lib/dashboard/fetch-settings-page-data"

export const runtime = "nodejs"

/**
 * Team settings page data after client mount. Auth via cookie JWT + getUser (not auth.getSession()).
 */
export async function GET() {
  try {
    const sessionResult = await getRequestUserLite()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const u = sessionResult.user
    const supabase = getSupabaseServer()

    const { userProfile, teamData, calendarSettings, players } = await fetchSettingsPageBundle(
      supabase,
      u.id,
      u.teamId
    )

    if (!userProfile) {
      return NextResponse.json({ error: "No profile" }, { status: 404 })
    }

    const roleUpper = (u.role ?? "").toUpperCase()
    const needsOnboarding = !teamData && roleUpper === "HEAD_COACH"

    const res = NextResponse.json({
      userProfile,
      teamData,
      calendarSettings,
      players,
      userRole: u.role ?? "",
      needsOnboarding,
    })
    if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    return res
  } catch (err) {
    console.error("[GET /api/me/settings-page-bundle]", err)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}
