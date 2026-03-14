import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"

/**
 * GET /api/roster/depth-chart?teamId=xxx
 * Returns depth chart entries for the team.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    // Get depth chart entries
    const { data: entries, error: entriesError } = await supabase
      .from("depth_chart_entries")
      .select("id, unit, position, string, player_id, formation, special_team_type")
      .eq("team_id", teamId)
      .order("unit", { ascending: true })
      .order("position", { ascending: true })
      .order("string", { ascending: true })

    if (entriesError) {
      console.error("[GET /api/roster/depth-chart] entries query error:", {
        message: entriesError.message,
        details: entriesError.details,
        hint: entriesError.hint,
        code: entriesError.code,
      })
      return NextResponse.json(
        { error: "Failed to load depth chart", details: entriesError.message },
        { status: 500 }
      )
    }

    // Get player details for entries with player_id
    const playerIds = [...new Set((entries ?? []).filter((e) => e.player_id).map((e) => e.player_id!))] // Remove duplicates
    let playersMap = new Map<string, { id: string; firstName: string; lastName: string; jerseyNumber: number | null; imageUrl: string | null }>()
    if (playerIds.length > 0) {
      try {
        const { data: players, error: playersError } = await supabase
          .from("players")
          .select("id, first_name, last_name, jersey_number, image_url")
          .in("id", playerIds)

        if (playersError) {
          console.error("[GET /api/roster/depth-chart] players query error:", {
            message: playersError.message,
            details: playersError.details,
            hint: playersError.hint,
            code: playersError.code,
          })
          // Continue without player data rather than failing completely
        } else {
          playersMap = new Map(
            (players ?? []).map((p) => [
              p.id,
              {
                id: p.id,
                firstName: p.first_name ?? "",
                lastName: p.last_name ?? "",
                jerseyNumber: p.jersey_number ?? null,
                imageUrl: normalizePlayerImageUrl(p.image_url) ?? null,
              },
            ])
          )
        }
      } catch (err) {
        console.error("[GET /api/roster/depth-chart] players query exception:", err)
        // Continue without player data rather than failing completely
      }
    }

    // Format response
    const formatted = (entries ?? []).map((e) => ({
      id: e.id,
      unit: e.unit,
      position: e.position,
      string: e.string,
      playerId: e.player_id,
      player: e.player_id ? playersMap.get(e.player_id) || null : null,
      formation: e.formation || null,
      specialTeamType: e.special_team_type || null,
    }))

    return NextResponse.json({ entries: formatted })
  } catch (error: any) {
    console.error("[GET /api/roster/depth-chart]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load depth chart" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/roster/depth-chart?teamId=xxx
 * Updates depth chart entries (supports POST for compatibility).
 */
export async function POST(request: Request) {
  return PATCH(request)
}

/**
 * PATCH /api/roster/depth-chart?teamId=xxx
 * Updates depth chart entries.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const body = (await request.json()) as {
      entries?: Array<{
        unit: string
        position: string
        string: number
        playerId: string | null
        formation?: string | null
        specialTeamType?: string | null
      }>
      updates?: Array<{
        unit: string
        position: string
        string: number
        playerId: string | null
        formation?: string | null
        specialTeamType?: string | null
      }>
    }

    const updates = body.entries || body.updates || []

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Normalize and validate: ensure string is number, reject invalid rows; dedupe by (unit, position, string)
    type Row = { team_id: string; unit: string; position: string; string: number; player_id: string | null; formation: string | null; special_team_type: string | null }
    const seen = new Set<string>()
    const entriesToInsert: Row[] = []
    for (const u of updates) {
      const stringNum = typeof u.string === "number" ? u.string : parseInt(String(u.string), 10)
      if (Number.isNaN(stringNum) || stringNum < 1) continue
      const unit = String(u.unit ?? "").trim()
      const position = String(u.position ?? "").trim()
      if (!unit || !position) continue
      const key = `${unit}:${position}:${stringNum}`
      if (seen.has(key)) continue
      seen.add(key)
      entriesToInsert.push({
        team_id: teamId,
        unit,
        position,
        string: stringNum,
        player_id: u.playerId && String(u.playerId).trim() ? u.playerId : null,
        formation: u.formation != null && String(u.formation).trim() !== "" ? String(u.formation).trim() : null,
        special_team_type: u.specialTeamType != null && String(u.specialTeamType).trim() !== "" ? String(u.specialTeamType).trim() : null,
      })
    }

    if (entriesToInsert.length === 0) {
      return NextResponse.json({ error: "No valid entries (unit, position, and string >= 1 required)" }, { status: 400 })
    }

    // Delete existing entries for the positions being updated
    const positionsToUpdate = entriesToInsert.map((u) => ({ unit: u.unit, position: u.position }))
    const uniquePositions = Array.from(new Set(positionsToUpdate.map((p) => `${p.unit}:${p.position}`)))

    for (const posKey of uniquePositions) {
      const [unit, position] = posKey.split(":")
      const { error: deleteError } = await supabase
        .from("depth_chart_entries")
        .delete()
        .eq("team_id", teamId)
        .eq("unit", unit)
        .eq("position", position)
      if (deleteError) {
        console.error("[PATCH /api/roster/depth-chart] delete error:", deleteError)
        // Continue; insert may still succeed if no rows matched
      }
    }

    const { error: insertError } = await supabase.from("depth_chart_entries").insert(entriesToInsert)

    if (insertError) {
      console.error("[PATCH /api/roster/depth-chart] insert error:", {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      })
      return NextResponse.json(
        {
          error: "Failed to update depth chart",
          details: insertError.message,
          code: insertError.code,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[PATCH /api/roster/depth-chart]", error)
    return NextResponse.json(
      { error: error.message || "Failed to update depth chart" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
