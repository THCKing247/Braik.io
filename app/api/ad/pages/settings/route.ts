import { NextResponse } from "next/server"
import { applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getCachedAppAdPortalBootstrap } from "@/lib/app/app-bootstrap-cache"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"

export const runtime = "nodejs"

export async function GET() {
  try {
    const sessionResult = await getRequestAuth()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const u = sessionResult.user
    const supabase = getSupabaseServer()

    let shell: AppAdPortalBootstrapPayload
    try {
      shell = await getCachedAppAdPortalBootstrap(
        u.id,
        u.email,
        u.role ?? "",
        u.isPlatformOwner === true,
        false
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === "AD_BOOTSTRAP_FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      throw err
    }

    if (!shell.flags.tabVisibility.showSettings) {
      const res = NextResponse.json({ redirectTo: "/dashboard/ad/teams" as const })
      if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
      return res
    }

    let school: {
      name: string
      city: string | null
      state: string | null
      school_type: string | null
      mascot: string | null
      website: string | null
    } | null = null
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", u.id).maybeSingle()
    if (profile?.school_id) {
      const { data } = await supabase
        .from("schools")
        .select("name, city, state, school_type, mascot, website")
        .eq("id", profile.school_id)
        .single()
      school = data
    }

    const res = NextResponse.json(
      { school },
      {
        headers: {
          "Cache-Control": "private, no-cache, must-revalidate",
        },
      }
    )
    if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    return res
  } catch (err) {
    console.error("[GET /api/ad/pages/settings]", err)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}
