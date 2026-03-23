/**
 * POST /api/teams/[teamId]/games — create a scheduled game (coaches with edit_roster).
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { resolveSeasonIdForTeam } from "@/lib/team-season-resolve"

const GAME_TYPES = new Set(["regular", "playoff", "scrimmage", "tournament"])
const RESULTS = new Set(["win", "loss", "tie"])

type Body = {
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

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId?.trim()) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const body = (await request.json().catch(() => null)) as Body | null
    const opponent = body?.opponent?.trim() ?? ""
    const gameDateRaw = body?.gameDate?.trim() ?? ""
    if (!opponent || !gameDateRaw) {
      return NextResponse.json({ error: "opponent and gameDate are required" }, { status: 400 })
    }

    const gameMs = Date.parse(gameDateRaw)
    if (!Number.isFinite(gameMs)) {
      return NextResponse.json({ error: "Invalid gameDate" }, { status: 400 })
    }
    const game_date = new Date(gameMs).toISOString()

    let game_type: string | null = body?.gameType?.trim().toLowerCase() ?? "regular"
    if (game_type && !GAME_TYPES.has(game_type)) {
      return NextResponse.json({ error: "Invalid gameType" }, { status: 400 })
    }
    if (!game_type) game_type = "regular"

    const resultRaw = body?.result?.trim().toLowerCase() ?? ""
    const result = resultRaw && RESULTS.has(resultRaw) ? resultRaw : null

    const season_id = await resolveSeasonIdForTeam(supabase, teamId)

    const insertRow = {
      season_id,
      team_id: teamId,
      opponent,
      game_date,
      location: body?.location?.trim() || null,
      game_type,
      conference_game: Boolean(body?.conferenceGame),
      result,
      team_score: typeof body?.teamScore === "number" ? body.teamScore : null,
      opponent_score: typeof body?.opponentScore === "number" ? body.opponentScore : null,
      notes: body?.notes?.trim() || null,
      confirmed_by_coach: Boolean(body?.confirmedByCoach),
      confirmed_at: body?.confirmedByCoach ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    const { data: inserted, error } = await supabase.from("games").insert(insertRow).select("id").single()
    if (error || !inserted?.id) {
      console.error("[POST /api/teams/.../games]", error)
      return NextResponse.json({ error: "Failed to create game" }, { status: 500 })
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/schedule")

    return NextResponse.json({ id: inserted.id as string }, { status: 201 })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[POST /api/teams/.../games]", err)
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 })
  }
}
