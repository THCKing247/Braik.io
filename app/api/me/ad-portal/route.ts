import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getAdPortalAccessForUser, adPortalShowsOverviewAndSettings } from "@/lib/ad-portal-access"

export const runtime = "nodejs"

/** Client helper: varsity HC / AD portal entry and nav scope (no separate “director” shell). */
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServer()
    const access = await getAdPortalAccessForUser(
      supabase,
      session.user.id,
      session.user.role?.toUpperCase()
    )

    const canEnter = access.mode !== "none"

    const restricted = access.mode === "restricted_football"
    const showOverviewAndSettings = adPortalShowsOverviewAndSettings(access)

    return NextResponse.json({
      canEnterAdPortal: canEnter,
      mode: access.mode,
      restrictedFootball: restricted,
      showOverviewAndSettings,
      /** First stop in athletic department shell after login (varsity HC with football scope). */
      defaultPath: restricted ? "/dashboard/ad/teams" : "/dashboard/ad",
    })
  } catch (e) {
    console.error("[GET /api/me/ad-portal]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
