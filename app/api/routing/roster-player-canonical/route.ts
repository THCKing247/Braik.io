import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  buildDashboardTeamPlayerPath,
  resolveCanonicalPlayerRouteByPlayerUuid,
} from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

/**
 * Legacy player UUID → canonical `/dashboard/org/:shortOrgId/team/:shortTeamId/roster/:playerAccountId`.
 * Optional `nested` query (e.g. `/recruiting`) appended after the roster segment.
 */
export async function GET(request: Request) {
  const auth = await getRequestAuth()
  if (!auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const playerId = url.searchParams.get("playerId")?.trim()
  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 })
  }

  const canonical = await resolveCanonicalPlayerRouteByPlayerUuid(getSupabaseServer(), playerId)
  if (!canonical) {
    return NextResponse.json({ error: "Player not found for canonical route" }, { status: 404 })
  }

  const nestedRaw = url.searchParams.get("nested")?.trim() ?? ""
  const nested =
    nestedRaw && nestedRaw !== "/"
      ? nestedRaw.startsWith("/")
        ? nestedRaw
        : `/${nestedRaw}`
      : ""

  const base = buildDashboardTeamPlayerPath(canonical)
  const path = nested ? `${base.replace(/\/$/, "")}${nested}` : base

  return NextResponse.json({
    shortOrgId: canonical.shortOrgId,
    shortTeamId: canonical.shortTeamId,
    playerAccountId: canonical.playerAccountId,
    path,
  })
}
