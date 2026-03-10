import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"

/**
 * POST /api/roster/import
 * Imports players from CSV file.
 * Expected CSV format: firstName,lastName,grade,jerseyNumber,positionGroup,email,notes,weight,height
 * Columns 8 and 9 (weight, height) are optional. Weight should be a number (lbs); height is text (e.g. 5'10" or 6-2).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const teamId = formData.get("teamId") as string | null

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const supabase = getSupabaseServer()

    // Verify team exists
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Parse CSV
    const text = await file.text()
    const lines = text.split("\n").filter((line) => line.trim())
    if (lines.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 })
    }

    // Skip header row if present
    const header = lines[0].toLowerCase()
    const hasHeader = header.includes("first") || header.includes("name") || header.includes("grade")
    const dataLines = hasHeader ? lines.slice(1) : lines

    const playersToInsert: Array<{
      team_id: string
      first_name: string
      last_name: string
      grade: number | null
      jersey_number: number | null
      position_group: string | null
      email: string | null
      notes: string | null
      weight: number | null
      height: string | null
      status: string
      created_by: string
    }> = []

    for (const line of dataLines) {
      if (!line.trim()) continue

      const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""))
      if (parts.length < 2) continue // Need at least first and last name

      const firstName = parts[0] || ""
      const lastName = parts[1] || ""
      if (!firstName || !lastName) continue

      const grade = parts[2] ? parseInt(parts[2], 10) : null
      const jerseyNumber = parts[3] ? parseInt(parts[3], 10) : null
      const positionGroup = parts[4] || null
      const email = parts[5] ? parts[5].toLowerCase().trim() : null
      const notes = parts[6] || null
      const weightRaw = parts[7] ? parseInt(parts[7], 10) : null
      const weight = weightRaw != null && !Number.isNaN(weightRaw) ? weightRaw : null
      const height = parts[8] ? parts[8].trim() || null : null

      playersToInsert.push({
        team_id: teamId,
        first_name: firstName,
        last_name: lastName,
        grade: Number.isNaN(grade) ? null : grade,
        jersey_number: Number.isNaN(jerseyNumber) ? null : jerseyNumber,
        position_group: positionGroup,
        email: email,
        notes: notes,
        weight,
        height,
        status: "active",
        created_by: session.user.id,
      })
    }

    if (playersToInsert.length === 0) {
      return NextResponse.json({ error: "No valid players found in CSV" }, { status: 400 })
    }

    // Insert players (batch insert)
    const { data: inserted, error: insertError } = await supabase
      .from("players")
      .insert(playersToInsert)
      .select("id, first_name, last_name, grade, jersey_number, position_group, status, notes, image_url, email, invite_code, invite_status, claimed_at, user_id, weight, height")

    if (insertError) {
      console.error("[POST /api/roster/import]", insertError)
      return NextResponse.json({ error: "Failed to import players" }, { status: 500 })
    }

    // Format response
    const formatted = (inserted ?? []).map((p) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      grade: p.grade,
      jerseyNumber: p.jersey_number,
      positionGroup: p.position_group,
      status: p.status,
      notes: p.notes,
      imageUrl: normalizePlayerImageUrl(p.image_url),
      email: p.email || null,
      inviteCode: p.invite_code || null,
      inviteStatus: (p.invite_status as "not_invited" | "invited" | "joined") || "not_invited",
      claimedAt: p.claimed_at || null,
      weight: (p as { weight?: number | null }).weight ?? null,
      height: (p as { height?: string | null }).height ?? null,
      user: p.user_id ? { email: "" } : null,
      guardianLinks: [],
    }))

    return NextResponse.json({ players: formatted })
  } catch (error: any) {
    console.error("[POST /api/roster/import]", error)
  return NextResponse.json(
      { error: error.message || "Failed to import roster" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
  )
  }
}
