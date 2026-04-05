import { NextResponse } from "next/server"
import { applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { fetchSettingsPageBundle } from "@/lib/dashboard/fetch-settings-page-data"
import { braikPerfServerEnabled } from "@/lib/perf/braik-perf-config"
import { applyServerTiming, perfLogServer } from "@/lib/perf/braik-perf-server"

export const runtime = "nodejs"

/**
 * Team settings page data after client mount. Auth via cookie JWT + getUser (not auth.getSession()).
 */
export async function GET() {
  const t0 = performance.now()
  try {
    const sessionResult = await getRequestAuth()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const u = sessionResult.user
    const supabase = getSupabaseServer()
    const tAfterAuth = performance.now()

    const { userProfile, teamData, calendarSettings, players } = await fetchSettingsPageBundle(
      supabase,
      u.id,
      u.teamId,
      { authUser: u }
    )
    const tAfterData = performance.now()

    if (!userProfile) {
      return NextResponse.json({ error: "No profile" }, { status: 404 })
    }

    const roleUpper = (u.role ?? "").toUpperCase()
    const needsOnboarding = !teamData && roleUpper === "HEAD_COACH"

    const res = NextResponse.json(
      {
        userProfile,
        teamData,
        calendarSettings,
        players,
        userRole: u.role ?? "",
        needsOnboarding,
      },
      {
        headers: {
          // User-specific; allow HTTP revalidation instead of relying on client fetch cache: "no-store".
          "Cache-Control": "private, no-cache, must-revalidate",
        },
      }
    )
    if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    if (braikPerfServerEnabled()) {
      const msAuth = Math.round(tAfterAuth - t0)
      const msBundle = Math.round(tAfterData - tAfterAuth)
      perfLogServer("api.GET.me.settings-page-bundle", {
        ms_total: Math.round(performance.now() - t0),
        ms_auth: msAuth,
        ms_settings_bundle: msBundle,
        teamId: u.teamId ?? "",
      })
      applyServerTiming(res, [
        { name: "auth", dur: msAuth },
        { name: "settings_bundle", dur: msBundle },
        { name: "total", dur: Math.round(performance.now() - t0) },
      ])
    }
    return res
  } catch (err) {
    console.error("[GET /api/me/settings-page-bundle]", err)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}
