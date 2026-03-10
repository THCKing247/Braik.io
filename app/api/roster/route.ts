import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"

/** Player row shape from DB (GET select + optional new columns from migration). */
type PlayerRow = {
  id: string
  first_name: string
  last_name: string
  grade: number | null
  jersey_number: number | null
  position_group: string | null
  status: string
  notes: string | null
  image_url: string | null
  user_id: string | null
  email?: string | null
  invite_code?: string | null
  invite_status?: string | null
  claimed_at?: string | null
  created_by?: string | null
  weight?: number | null
  height?: string | null
}

/**
 * GET /api/roster?teamId=xxx
 * Returns team roster (players) for RosterManagerEnhanced.
 * Resolves team from query; enforces team membership.
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
    const { data: team, error: teamErr } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (teamErr) {
      console.error("[GET /api/roster] teams lookup failed", { teamId, error: teamErr })
      return NextResponse.json({ error: "Failed to load roster" }, { status: 500 })
    }
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const { data: rows, error } = await supabase
      .from("players")
      .select("id, first_name, last_name, grade, jersey_number, position_group, status, notes, image_url, user_id, email, invite_code, invite_status, claimed_at, created_by, health_status, weight, height")
      .eq("team_id", teamId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })

    if (error) {
      console.error("[GET /api/roster]", error.message, error)
      return NextResponse.json(
        { error: "Failed to load roster" },
        { status: 500 }
      )
    }

    const typedRows = (rows ?? []) as PlayerRow[]
    const userIds = [...new Set(typedRows.map((r) => r.user_id).filter(Boolean))] as string[]
    let userMap = new Map<string, { id: string; email: string }>()
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, email")
        .in("id", userIds)
      userMap = new Map((users ?? []).map((u) => [u.id, u]))
    }

    const players = typedRows.map((p) => ({
      id: p.id,
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      grade: p.grade ?? null,
      jerseyNumber: p.jersey_number ?? null,
      positionGroup: p.position_group ?? null,
      status: p.status ?? "active",
      notes: p.notes ?? null,
      imageUrl: normalizePlayerImageUrl(p.image_url) ?? null,
      email: p.email ?? null,
      inviteCode: p.invite_code ?? null,
      inviteStatus: (p.invite_status ?? "not_invited") as "not_invited" | "invited" | "joined",
      claimedAt: p.claimed_at ?? null,
      healthStatus: ((p as any).health_status ?? "active") as "active" | "injured" | "unavailable",
      weight: (p as any).weight ?? null,
      height: (p as any).height ?? null,
      user: p.user_id ? (userMap.get(p.user_id) ? { email: userMap.get(p.user_id)!.email } : null) : null,
      guardianLinks: [] as Array<{ guardian: { user: { email: string } } }>,
    }))

    return NextResponse.json(players)
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[GET /api/roster] membership lookup failed (DB/schema)", { error: err.message, cause: err.cause })
      return NextResponse.json({ error: "Failed to load roster" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json(
        {
          error: "You don't have access to this team's roster.",
          code: "TEAM_ACCESS_DENIED",
          hint: "If you recently joined this team, try refreshing the page or signing out and back in. If the problem persists, ask your coach to re-send the team invite.",
        },
        { status: 403 }
      )
    }
    console.error("[GET /api/roster]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/roster - Add player (coach-created profile; no auth user required).
 * Business rule: Coach creates a roster record first; later the player can sign up and link (claim) it.
 * If they do, that counts as a billable roster slot (see billing warning in UI).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const teamId = body?.teamId
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const { requireTeamPermission, MembershipLookupError } = await import("@/lib/auth/rbac")
    await requireTeamPermission(teamId, "edit_roster")

    const firstName = String(body?.firstName ?? "").trim()
    const lastName = String(body?.lastName ?? "").trim()
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 })
    }

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() || null : null
    const jerseyNumber = body?.jerseyNumber != null ? Number(body.jerseyNumber) : null
    const positionGroup = typeof body?.positionGroup === "string" ? body.positionGroup.trim().toUpperCase() || null : null

    const supabase = getSupabaseServer()

    // Helper function to determine position side
    const getPositionSide = (pos: string | null): "offense" | "defense" | "special" | null => {
      if (!pos) return null
      const offensePositions = ["QB", "RB", "WR", "TE", "OL"]
      const defensePositions = ["DL", "LB", "DB"]
      const specialPositions = ["K", "P"]
      if (offensePositions.includes(pos)) return "offense"
      if (defensePositions.includes(pos)) return "defense"
      if (specialPositions.includes(pos)) return "special"
      return null
    }

    // Duplicate check: same team + first+last name + same jersey (or same email if provided)
    const { data: existingByName } = await supabase
      .from("players")
      .select("id, jersey_number, position_group")
      .eq("team_id", teamId)
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)

    // Jersey number validation: allow duplicate if one is offense and one is defense
    let duplicateByJersey = false
    if (jerseyNumber != null && jerseyNumber >= 0 && jerseyNumber <= 99) {
      const newPlayerSide = getPositionSide(positionGroup)
      
      // Check for jersey conflicts
      const { data: existingByJersey } = await supabase
        .from("players")
        .select("id, first_name, last_name, position_group")
        .eq("team_id", teamId)
        .eq("jersey_number", jerseyNumber)

      if (existingByJersey && existingByJersey.length > 0) {
        // If new player has no position or special teams, allow duplicate
        if (!newPlayerSide || newPlayerSide === "special") {
          // Special teams can share numbers, but check if there's a conflict with same side
          const hasConflict = existingByJersey.some((p) => {
            const existingSide = getPositionSide(p.position_group)
            return existingSide === newPlayerSide
          })
          if (hasConflict && newPlayerSide) {
            duplicateByJersey = true
          }
        } else {
          // Check if any existing player with same jersey is on the same side
          const hasSameSideConflict = existingByJersey.some((p) => {
            const existingSide = getPositionSide(p.position_group)
            // Conflict if both are offense or both are defense
            return existingSide === newPlayerSide
          })
          if (hasSameSideConflict) {
            duplicateByJersey = true
          }
        }
      }
    } else if (jerseyNumber != null && (jerseyNumber < 0 || jerseyNumber > 99)) {
      return NextResponse.json(
        { error: "Jersey number must be between 0 and 99." },
        { status: 400 }
      )
    }

    // Same first+last name with no jersey given: treat as duplicate to avoid multiple "John Smith" placeholders
    const duplicateByNameOnly = (existingByName?.length ?? 0) > 0 && jerseyNumber == null
    let duplicateByEmail = false
    if (email) {
      const { data: byEmail } = await supabase
        .from("players")
        .select("id")
        .eq("team_id", teamId)
        .ilike("email", email)
        .maybeSingle()
      duplicateByEmail = !!byEmail
    }
    if (duplicateByJersey) {
      return NextResponse.json(
        { error: "Jersey number is already in use by a player on the same side (offense/defense). Two players with the same number cannot both be on the same side of the ball." },
        { status: 409 }
      )
    }
    if (duplicateByEmail || duplicateByNameOnly) {
      return NextResponse.json(
        { error: "A player with this name (or email) already exists on this roster." },
        { status: 409 }
      )
    }

    const weight = body?.weight != null ? Number(body.weight) : null
    const height = typeof body?.height === "string" ? body.height.trim() || null : null

    const insertPayload: Record<string, unknown> = {
      team_id: teamId,
      first_name: firstName,
      last_name: lastName,
      grade: body?.grade ?? null,
      jersey_number: jerseyNumber ?? null,
      position_group: body?.positionGroup ?? null,
      notes: body?.notes ?? null,
      status: "active",
      weight: weight,
      height: height,
      invite_status: "not_invited",
      created_by: session.user.id,
      email: email ?? null,
    }

    const { data: player, error } = await supabase
      .from("players")
      .insert(insertPayload)
      .select()
      .single()

    if (error || !player) {
      console.error("[POST /api/roster]", error?.message, error)
      return NextResponse.json(
        { error: error?.message ?? "Failed to add player" },
        { status: 500 }
      )
    }

    const p = player as PlayerRow & { email?: string | null; invite_code?: string | null; invite_status?: string; created_by?: string | null }
    const out = {
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      grade: p.grade ?? null,
      jerseyNumber: p.jersey_number ?? null,
      positionGroup: p.position_group ?? null,
      status: p.status ?? "active",
      notes: p.notes ?? null,
      imageUrl: normalizePlayerImageUrl(p.image_url) ?? null,
      email: p.email ?? null,
      inviteCode: p.invite_code ?? null,
      inviteStatus: (p.invite_status ?? "not_invited") as "not_invited" | "invited" | "joined",
      claimedAt: (player as { claimed_at?: string | null }).claimed_at ?? null,
      weight: (p as any).weight ?? null,
      height: (p as any).height ?? null,
      user: null as { email: string } | null,
      guardianLinks: [] as Array<{ guardian: { user: { email: string } } }>,
    }
    return NextResponse.json(out)
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[POST /api/roster] membership lookup failed (DB/schema)", { error: err.message, cause: err.cause })
      return NextResponse.json({ error: "Failed to add player" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member") || message.includes("Insufficient")) {
      return NextResponse.json(
        {
          error: message.includes("Insufficient") ? "You don't have permission to edit the roster." : "You don't have access to this team's roster.",
          code: "TEAM_ACCESS_DENIED",
          hint: "If you recently joined this team, try refreshing the page or signing out and back in. If the problem persists, ask your coach to re-send the team invite.",
        },
        { status: 403 }
      )
    }
    console.error("[POST /api/roster]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
