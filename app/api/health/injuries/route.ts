import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

/**
 * GET /api/health/injuries?teamId=xxx
 * Returns all injuries for a team
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const playerId = searchParams.get("playerId")?.trim() || null
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const supabase = getSupabaseServer()
    let injuryQuery = supabase
      .from("player_injuries")
      .select(`
        id,
        player_id,
        injury_reason,
        injury_date,
        expected_return_date,
        actual_return_date,
        status,
        notes,
        severity,
        exempt_from_practice,
        created_at,
        updated_at,
        players (
          id,
          first_name,
          last_name,
          jersey_number
        )
      `)
      .eq("team_id", teamId)
    if (playerId) {
      injuryQuery = injuryQuery.eq("player_id", playerId)
    }
    const { data: injuries, error } = await injuryQuery.order("injury_date", { ascending: false })

    if (error) {
      console.error("[GET /api/health/injuries]", error)
      return NextResponse.json({ error: "Failed to load injuries" }, { status: 500 })
    }

    return NextResponse.json({ injuries: injuries || [] })
  } catch (error: any) {
    console.error("[GET /api/health/injuries]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load injuries" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/health/injuries
 * Creates a new injury record
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { playerId, teamId, injuryReason, injuryDate, expectedReturnDate, notes, severity, exemptFromPractice } = body

    const reasonTrimmed = typeof injuryReason === "string" ? injuryReason.trim() : ""
    if (!playerId || !teamId || !reasonTrimmed) {
      return NextResponse.json(
        { error: "playerId, teamId, and a non-empty injuryReason are required" },
        { status: 400 }
      )
    }

    await requireTeamPermission(teamId, "edit_roster")

    const supabase = getSupabaseServer()

    const { data: playerRow, error: playerLookupErr } = await supabase
      .from("players")
      .select("id")
      .eq("id", playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (playerLookupErr) {
      console.error("[POST /api/health/injuries] player lookup", playerLookupErr)
      return NextResponse.json({ error: "Failed to verify player" }, { status: 500 })
    }
    if (!playerRow) {
      return NextResponse.json(
        { error: "That player is not on this team. Refresh the roster and try again." },
        { status: 400 }
      )
    }

    // Create injury record
    const { data: injury, error: injuryError } = await supabase
      .from("player_injuries")
      .insert({
        player_id: playerId,
        team_id: teamId,
        injury_reason: reasonTrimmed,
        injury_date: injuryDate ? new Date(injuryDate).toISOString() : new Date().toISOString(),
        expected_return_date: expectedReturnDate ? new Date(expectedReturnDate).toISOString() : null,
        notes: notes || null,
        status: "active",
        created_by: session.user.id,
        severity: typeof severity === "string" && severity.trim() ? severity.trim() : null,
        exempt_from_practice: exemptFromPractice === true,
      })
      .select()
      .single()

    if (injuryError) {
      console.error("[POST /api/health/injuries]", injuryError)
      return NextResponse.json({ error: "Failed to create injury record" }, { status: 500 })
    }

    // Create calendar event for expected return date if provided
    if (expectedReturnDate && injury) {
      const { data: player } = await supabase
        .from("players")
        .select("first_name, last_name")
        .eq("id", playerId)
        .single()

      if (player) {
        const returnDate = new Date(expectedReturnDate)
        const eventTitle = `${player.first_name} ${player.last_name} - Expected Return`
        
        await supabase
          .from("events")
          .insert({
            team_id: teamId,
            event_type: "CUSTOM",
            title: eventTitle,
            description: `Expected return from injury: ${injuryReason}`,
            start: returnDate.toISOString(),
            end: new Date(returnDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour event
            visibility: "COACHES_ONLY",
            created_by: session.user.id,
            linked_injury_id: injury.id,
          })
      }
    }

    return NextResponse.json({ injury })
  } catch (error: any) {
    console.error("[POST /api/health/injuries]", error)
    return NextResponse.json(
      { error: error.message || "Failed to create injury" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/health/injuries/[injuryId]
 * Updates an injury record (e.g., mark as resolved, update return date)
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { injuryId, teamId, status, expectedReturnDate, actualReturnDate, notes, severity, exemptFromPractice } = body

    if (!injuryId || !teamId) {
      return NextResponse.json({ error: "injuryId and teamId are required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const supabase = getSupabaseServer()
    
    const updateData: any = {}
    if (status) updateData.status = status
    if (expectedReturnDate) updateData.expected_return_date = new Date(expectedReturnDate).toISOString()
    if (actualReturnDate) updateData.actual_return_date = new Date(actualReturnDate).toISOString()
    if (notes !== undefined) updateData.notes = notes
    if (severity !== undefined) {
      updateData.severity = typeof severity === "string" && severity.trim() ? severity.trim() : null
    }
    if (exemptFromPractice !== undefined) updateData.exempt_from_practice = exemptFromPractice === true
    updateData.updated_at = new Date().toISOString()

    const { data: injury, error } = await supabase
      .from("player_injuries")
      .update(updateData)
      .eq("id", injuryId)
      .eq("team_id", teamId)
      .select()
      .maybeSingle()

    if (error) {
      console.error("[PATCH /api/health/injuries]", error)
      return NextResponse.json({ error: "Failed to update injury" }, { status: 500 })
    }
    if (!injury) {
      return NextResponse.json(
        { error: "Injury not found for this team, or it was already removed." },
        { status: 404 }
      )
    }

    const resolved = typeof status === "string" && status.toLowerCase() === "resolved"
    trackProductEventServer({
      eventName: resolved ? BRAIK_EVENTS.health.injury_resolved : BRAIK_EVENTS.health.injury_updated,
      userId: session.user.id,
      teamId,
      role: session.user.role ?? null,
      metadata: { injury_id: injuryId, new_status: status ?? null },
    })

    // Update calendar event if return date changed
    if (expectedReturnDate && injury) {
      const { data: events } = await supabase
        .from("events")
        .select("id")
        .eq("linked_injury_id", injuryId)
        .maybeSingle()

      if (events) {
        const returnDate = new Date(expectedReturnDate)
        await supabase
          .from("events")
          .update({
            start: returnDate.toISOString(),
            end: new Date(returnDate.getTime() + 60 * 60 * 1000).toISOString(),
          })
          .eq("id", events.id)
      }
    }

    return NextResponse.json({ injury })
  } catch (error: any) {
    console.error("[PATCH /api/health/injuries]", error)
    return NextResponse.json(
      { error: error.message || "Failed to update injury" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
