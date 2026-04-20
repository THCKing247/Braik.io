import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  buildDashboardTeamPlayerPath,
  resolveCanonicalPlayerRouteByPlayerUuid,
} from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

/**
 * Legacy internal `players.id` UUID → canonical `/dashboard/org/:shortOrgId/team/:shortTeamId/roster/:playerAccountId`.
 * Query `playerId` must be the internal UUID (middleware); optional `nested` (e.g. `/recruiting`) after the roster segment.
 */
export async function GET(request: Request) {
  const auth = await getRequestAuth()
  if (!auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  /** Value is internal `players.id` — param name `playerId` is historical for `/api/routing` callers. */
  const playerUuid = url.searchParams.get("playerId")?.trim()
  if (!playerUuid) {
    return NextResponse.json(
      { error: "Internal player UUID is required (pass as query param playerId)." },
      { status: 400 }
    )
  }

  const canonical = await resolveCanonicalPlayerRouteByPlayerUuid(getSupabaseServer(), playerUuid)
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
