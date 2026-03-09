import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

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
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const { data: rows, error } = await supabase
      .from("players")
      .select("id, first_name, last_name, grade, jersey_number, position_group, status, notes, image_url, user_id, email, invite_code, invite_status, claimed_at, created_by")
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
      imageUrl: p.image_url ?? null,
      email: p.email ?? null,
      inviteCode: p.invite_code ?? null,
      inviteStatus: (p.invite_status ?? "not_invited") as "not_invited" | "invited" | "joined",
      claimedAt: p.claimed_at ?? null,
      user: p.user_id ? (userMap.get(p.user_id) ? { email: userMap.get(p.user_id)!.email } : null) : null,
      guardianLinks: [] as Array<{ guardian: { user: { email: string } } }>,
    }))

    return NextResponse.json(players)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
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

    const { requireTeamPermission } = await import("@/lib/auth/rbac")
    await requireTeamPermission(teamId, "edit_roster")

    const firstName = String(body?.firstName ?? "").trim()
    const lastName = String(body?.lastName ?? "").trim()
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 })
    }

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() || null : null
    const jerseyNumber = body?.jerseyNumber != null ? Number(body.jerseyNumber) : null

    const supabase = getSupabaseServer()

    // Duplicate check: same team + first+last name + same jersey (or same email if provided)
    const { data: existingByName } = await supabase
      .from("players")
      .select("id, jersey_number")
      .eq("team_id", teamId)
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)

    const duplicateByJersey =
      jerseyNumber != null &&
      existingByName?.some((r) => (r as { jersey_number?: number }).jersey_number === jerseyNumber)
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
    if (duplicateByJersey || duplicateByEmail || duplicateByNameOnly) {
      return NextResponse.json(
        { error: "A player with this name and jersey number (or email) already exists on this roster." },
        { status: 409 }
      )
    }

    const insertPayload: Record<string, unknown> = {
      team_id: teamId,
      first_name: firstName,
      last_name: lastName,
      grade: body?.grade ?? null,
      jersey_number: jerseyNumber ?? null,
      position_group: body?.positionGroup ?? null,
      notes: body?.notes ?? null,
      status: "active",
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
      imageUrl: p.image_url ?? null,
      email: p.email ?? null,
      inviteCode: p.invite_code ?? null,
      inviteStatus: (p.invite_status ?? "not_invited") as "not_invited" | "invited" | "joined",
      claimedAt: (player as { claimed_at?: string | null }).claimed_at ?? null,
      user: null as { email: string } | null,
      guardianLinks: [] as Array<{ guardian: { user: { email: string } } }>,
    }
    return NextResponse.json(out)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/roster]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
