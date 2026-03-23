/**
 * POST /api/teams/[teamId]/games/import — multipart CSV bulk import (edit_roster).
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { resolveSeasonIdForTeam } from "@/lib/team-season-resolve"
import { parseGamesScheduleCsv } from "@/lib/games-import-csv"

const CSV_EXTENSION = /\.csv$/i
const CSV_MIME = /^text\/(csv|plain)|application\/csv$/i

function isCsvFile(file: File): boolean {
  const name = file.name || ""
  const type = file.type || ""
  return CSV_EXTENSION.test(name) || CSV_MIME.test(type)
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

    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }
    if (!isCsvFile(file)) {
      return NextResponse.json({ error: "Upload a CSV file" }, { status: 400 })
    }

    const text = await file.text()
    const parsed = parseGamesScheduleCsv(text)
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          inserted: 0,
          parseErrors: parsed.errors,
          rowErrors: [] as Array<{ row: number; message: string }>,
        },
        { status: 400 }
      )
    }

    const season_id = await resolveSeasonIdForTeam(supabase, teamId)

    const toInsert = parsed.rows.map((r) => ({
      season_id,
      team_id: teamId,
      opponent: r.opponent,
      game_date: r.gameDateIso,
      location: r.location,
      game_type: r.gameType,
      conference_game: r.conferenceGame,
      notes: r.notes,
      updated_at: new Date().toISOString(),
    }))

    const { error: insErr } = await supabase.from("games").insert(toInsert)
    if (insErr) {
      console.error("[games import]", insErr)
      return NextResponse.json(
        {
          success: false,
          inserted: 0,
          parseErrors: parsed.errors,
          rowErrors: [{ row: 0, message: insErr.message || "Database insert failed" }],
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      inserted: toInsert.length,
      parseErrors: parsed.errors,
      rowErrors: [] as Array<{ row: number; message: string }>,
    })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[POST games import]", err)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}
