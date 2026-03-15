import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

const STATUSES = ["watching", "contacted", "requested_film", "camp_invite", "offer", "closed"] as const

/**
 * POST /api/recruiting/interest
 * Log or update recruiter/school interest for a player. Coach must belong to the player's program.
 * Body: { playerId: string, programId: string, schoolName: string, coachName?: string, positionInterest?: string, status: string, notes?: string }
 * Or for update: { id: string, ... } with id of existing player_recruiter_interest row.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      id?: string
      playerId: string
      programId: string
      schoolName?: string
      coachName?: string | null
      positionInterest?: string | null
      status: string
      notes?: string | null
      recruiterUserId?: string | null
    }

    const { playerId, programId, schoolName, coachName, positionInterest, status, notes, id: existingId, recruiterUserId } = body
    if (!playerId || !programId) {
      return NextResponse.json({ error: "playerId and programId are required" }, { status: 400 })
    }
    if (!STATUSES.includes((status as string) as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const supabase = getSupabaseServer()
    const { data: player } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const { data: team } = await supabase
      .from("teams")
      .select("program_id")
      .eq("id", (player as { team_id: string }).team_id)
      .maybeSingle()

    if (!team || (team as { program_id?: string }).program_id !== programId) {
      return NextResponse.json({ error: "Player is not in this program" }, { status: 400 })
    }

    const school = (schoolName ?? "").trim() || (body as { school_name?: string }).school_name
    if (existingId) {
      const { data: existing } = await supabase
        .from("player_recruiter_interest")
        .select("id, player_id")
        .eq("id", existingId)
        .maybeSingle()
      if (!existing || (existing as { player_id: string }).player_id !== playerId) {
        return NextResponse.json({ error: "Interest record not found" }, { status: 404 })
      }
      const { data: updated, error } = await supabase
        .from("player_recruiter_interest")
        .update({
          school_name: school || (existing as { school_name?: string }).school_name,
          coach_name: coachName !== undefined ? coachName : undefined,
          position_interest: positionInterest !== undefined ? positionInterest : undefined,
          status,
          notes: notes !== undefined ? notes : undefined,
          recruiter_user_id: recruiterUserId ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingId)
        .select("id, status, updated_at")
        .single()

      if (error) {
        console.error("[POST /api/recruiting/interest] update", error)
        return NextResponse.json({ error: "Failed to update interest" }, { status: 500 })
      }
      return NextResponse.json({
        id: (updated as { id: string }).id,
        status: (updated as { status: string }).status,
        updatedAt: (updated as { updated_at: string }).updated_at,
      })
    }

    if (!school) {
      return NextResponse.json({ error: "schoolName is required for new interest" }, { status: 400 })
    }

    const { data: inserted, error } = await supabase
      .from("player_recruiter_interest")
      .insert({
        player_id: playerId,
        recruiter_user_id: recruiterUserId ?? null,
        school_name: school,
        coach_name: coachName ?? null,
        position_interest: positionInterest ?? null,
        status,
        notes: notes ?? null,
        created_by_user_id: session.user.id,
      })
      .select("id, school_name, status, created_at")
      .single()

    if (error) {
      console.error("[POST /api/recruiting/interest] insert", error)
      return NextResponse.json({ error: "Failed to log interest" }, { status: 500 })
    }

    return NextResponse.json({
      id: (inserted as { id: string }).id,
      schoolName: (inserted as { school_name: string }).school_name,
      status: (inserted as { status: string }).status,
      createdAt: (inserted as { created_at: string }).created_at,
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/recruiting/interest]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
