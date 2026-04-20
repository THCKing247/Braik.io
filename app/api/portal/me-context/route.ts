import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolveBraikPortalKind } from "@/lib/portal/resolve-portal-kind"
import {
  getParentPortalSegmentForUser,
  getPlayerAccountSegmentForUser,
} from "@/lib/portal/resolve-free-portal-segments"

export const runtime = "nodejs"

export type PortalMeContextPayload = {
  portalKind: import("@/lib/portal/braik-portal-kind").BraikPortalKind
  playerAccountSegment: string | null
  parentPortalSegment: string | null
}

/**
 * Lightweight portal routing context for standalone `/player` and `/parent` shells (segment validation).
 */
export async function GET() {
  const lite = await getRequestAuth()
  if (!lite?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseServer()
  const userId = lite.user.id
  const profileRoleUpper = (lite.user.role ?? "USER").toUpperCase()

  const portalKind = await resolveBraikPortalKind({
    supabase,
    userId,
    profileRoleUpper,
  })

  const [playerAccountSegment, parentPortalSegment] = await Promise.all([
    portalKind === "player" ? getPlayerAccountSegmentForUser(supabase, userId) : Promise.resolve(null),
    portalKind === "parent" ? getParentPortalSegmentForUser(supabase, userId) : Promise.resolve(null),
  ])

  const body: PortalMeContextPayload = {
    portalKind,
    playerAccountSegment,
    parentPortalSegment,
  }
  return NextResponse.json(body)
}
