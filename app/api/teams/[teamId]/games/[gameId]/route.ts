/**
 * PATCH / DELETE single game for a team (edit_roster).
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"

const GAME_TYPES = new Set(["regular", "playoff", "scrimmage", "tournament"])
const RESULTS = new Set(["win", "loss", "tie"])

type PatchBody = {
  opponent?: string
  gameDate?: string
  location?: string | null
  gameType?: string | null
  conferenceGame?: boolean
  result?: string | null
  teamScore?: number | null
  opponentScore?: number | null
  notes?: string | null
  confirmedByCoach?: boolean
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; gameId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameId } = await params
    if (!teamId?.trim() || !gameId?.trim()) {
      return NextResponse.json({ error: "teamId and gameId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: existing } = await supabase
      .from("games")
      .select("id, team_id")
      .eq("id", gameId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const body = (await request.json().catch(() => null)) as PatchBody | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.opponent !== undefined) {
      const o = String(body.opponent).trim()
      if (!o) return NextResponse.json({ error: "opponent cannot be empty" }, { status: 400 })
      patch.opponent = o
    }
    if (body.gameDate !== undefined) {
      const gameMs = Date.parse(String(body.gameDate))
      if (!Number.isFinite(gameMs)) {
        return NextResponse.json({ error: "Invalid gameDate" }, { status: 400 })
      }
      patch.game_date = new Date(gameMs).toISOString()
    }
    if (body.location !== undefined) {
      patch.location = body.location?.trim() || null
    }
    if (body.gameType !== undefined) {
      const gt = body.gameType?.trim().toLowerCase() ?? "regular"
      if (gt && !GAME_TYPES.has(gt)) {
        return NextResponse.json({ error: "Invalid gameType" }, { status: 400 })
      }
      patch.game_type = gt || "regular"
    }
    if (body.conferenceGame !== undefined) {
      patch.conference_game = Boolean(body.conferenceGame)
    }
    if (body.result !== undefined) {
      const r = body.result?.trim().toLowerCase() ?? ""
      patch.result = r && RESULTS.has(r) ? r : null
    }
    if (body.teamScore !== undefined) {
      if (body.teamScore === null) patch.team_score = null
      else if (typeof body.teamScore === "number" && !Number.isNaN(body.teamScore)) patch.team_score = body.teamScore
      else {
        const n = Number(body.teamScore)
        patch.team_score = Number.isFinite(n) ? Math.trunc(n) : null
      }
    }
    if (body.opponentScore !== undefined) {
      if (body.opponentScore === null) patch.opponent_score = null
      else if (typeof body.opponentScore === "number" && !Number.isNaN(body.opponentScore)) patch.opponent_score = body.opponentScore
      else {
        const n = Number(body.opponentScore)
        patch.opponent_score = Number.isFinite(n) ? Math.trunc(n) : null
      }
    }
    if (body.notes !== undefined) {
      patch.notes = body.notes?.trim() || null
    }
    if (body.confirmedByCoach !== undefined) {
      patch.confirmed_by_coach = Boolean(body.confirmedByCoach)
      patch.confirmed_at = body.confirmedByCoach ? new Date().toISOString() : null
    }

    const { error } = await supabase.from("games").update(patch).eq("id", gameId).eq("team_id", teamId)
    if (error) {
      console.error("[PATCH game]", error)
      return NextResponse.json({ error: "Failed to update game" }, { status: 500 })
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/schedule")

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[PATCH game]", err)
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; gameId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameId } = await params
    if (!teamId?.trim() || !gameId?.trim()) {
      return NextResponse.json({ error: "teamId and gameId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: existing } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const { error } = await supabase.from("games").delete().eq("id", gameId).eq("team_id", teamId)
    if (error) {
      console.error("[DELETE game]", error)
      return NextResponse.json({ error: "Failed to delete game" }, { status: 500 })
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/schedule")

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[DELETE game]", err)
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 })
  }
}
