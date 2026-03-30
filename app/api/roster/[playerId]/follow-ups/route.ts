import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { logPlayerProfileActivity } from "@/lib/player-profile-activity"
import { FOLLOW_UP_CATEGORY_LABELS, FOLLOW_UP_DEFAULT_DURATION_MS } from "@/lib/roster/follow-up-ui"
import { revalidateTeamCalendar } from "@/lib/cache/lightweight-get-cache"

const FOLLOW_UP_CATEGORIES = [
  "physical_follow_up",
  "waiver_reminder",
  "eligibility_review",
  "guardian_contact_follow_up",
  "equipment_follow_up",
  "other",
] as const

/**
 * GET /api/roster/[playerId]/follow-ups?teamId=xxx&status=open
 * List follow-ups for this player. Coach: any player. Player: own only.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const status = searchParams.get("status")?.trim() || null

    if (!playerId || !teamId) {
      return NextResponse.json({ error: "playerId and teamId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    const isCoach = membership ? canEditRoster(membership.role) : false
    const isOwn = (player as { user_id: string | null }).user_id === session.user.id
    if (!isCoach && !isOwn) {
      return NextResponse.json({ error: "You can only view follow-ups for your own profile." }, { status: 403 })
    }

    let query = supabase
      .from("player_follow_ups")
      .select("id, player_id, team_id, category, status, note, created_by, created_at, updated_at, resolved_at")
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })

    if (status === "open" || status === "resolved") {
      query = query.eq("status", status)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error("[GET /api/roster/.../follow-ups]", error.message)
      return NextResponse.json({ error: "Failed to load follow-ups" }, { status: 500 })
    }

    const createdByIds = [...new Set((rows ?? []).map((r) => (r as { created_by: string | null }).created_by).filter(Boolean))] as string[]
    let creatorMap = new Map<string, string>()
    if (createdByIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, name").in("id", createdByIds)
      creatorMap = new Map((users ?? []).map((u) => [u.id, (u as { name: string | null }).name ?? "Unknown"]))
    }

    const list = (rows ?? []).map((r) => {
      const row = r as {
        id: string
        player_id: string
        team_id: string
        category: string
        status: string
        note: string | null
        created_by: string | null
        created_at: string
        updated_at: string
        resolved_at: string | null
      }
      return {
        id: row.id,
        playerId: row.player_id,
        teamId: row.team_id,
        category: row.category,
        status: row.status,
        note: row.note ?? null,
        createdBy: row.created_by ? creatorMap.get(row.created_by) ?? null : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        resolvedAt: row.resolved_at,
        scheduledStart: null as string | null,
        scheduledEnd: null as string | null,
      }
    })

    const fuIds = list.map((x) => x.id)
    if (fuIds.length > 0) {
      const { data: evRows } = await supabase
        .from("events")
        .select("linked_follow_up_id, start, end")
        .eq("team_id", teamId)
        .in("linked_follow_up_id", fuIds)
      const evMap = new Map(
        (evRows ?? []).map((e) => [
          (e as { linked_follow_up_id: string }).linked_follow_up_id,
          e as { start: string; end: string },
        ])
      )
      for (const item of list) {
        const ev = evMap.get(item.id)
        if (ev) {
          item.scheduledStart = ev.start
          item.scheduledEnd = ev.end
        }
      }
    }

    return NextResponse.json(list)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/roster/.../follow-ups]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/roster/[playerId]/follow-ups
 * Create a follow-up and a linked team calendar event. Coach only.
 * Body: { category, note?, start | startAt (ISO), end? | endAt? (ISO, optional; defaults to start + 30m) }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!playerId || !teamId) {
      return NextResponse.json({ error: "playerId and teamId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id, first_name, last_name")
      .eq("id", playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can create follow-ups." }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as {
      category?: string
      note?: string
      start?: string
      startAt?: string
      end?: string
      endAt?: string
    }
    const category = typeof body.category === "string" ? body.category.trim() : ""
    if (!category || !FOLLOW_UP_CATEGORIES.includes(category as (typeof FOLLOW_UP_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Valid category is required" }, { status: 400 })
    }

    const startRaw = body.start ?? body.startAt
    const endRaw = body.end ?? body.endAt
    if (!startRaw || typeof startRaw !== "string") {
      return NextResponse.json({ error: "start time is required (ISO string)" }, { status: 400 })
    }
    const startMs = new Date(startRaw).getTime()
    if (Number.isNaN(startMs)) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 })
    }
    let endMs: number
    if (endRaw && typeof endRaw === "string") {
      endMs = new Date(endRaw).getTime()
      if (Number.isNaN(endMs)) {
        return NextResponse.json({ error: "Invalid end time" }, { status: 400 })
      }
    } else {
      endMs = startMs + FOLLOW_UP_DEFAULT_DURATION_MS
    }
    if (endMs <= startMs) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 })
    }

    const { data: inserted, error } = await supabase
      .from("player_follow_ups")
      .insert({
        player_id: playerId,
        team_id: teamId,
        category,
        status: "open",
        note: typeof body.note === "string" ? body.note.trim() || null : null,
        created_by: session.user.id,
      })
      .select("id, category, status, created_at")
      .single()

    if (error) {
      console.error("[POST /api/roster/.../follow-ups]", error.message)
      return NextResponse.json({ error: "Failed to create follow-up" }, { status: 500 })
    }

    const insertedRow = inserted as { id: string }
    const pRow = player as { first_name: string | null; last_name: string | null }
    const playerName = [pRow.first_name, pRow.last_name].filter(Boolean).join(" ").trim() || "Player"
    const catLabel = FOLLOW_UP_CATEGORY_LABELS[category] ?? category
    const eventTitle = `Follow-up: ${playerName} · ${catLabel}`
    const noteVal = typeof body.note === "string" ? body.note.trim() || null : null

    const userTableRole = profileRoleToUserRole((session.user.role ?? "user").toLowerCase())
    try {
      await supabase
        .from("users")
        .upsert(
          {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name ?? null,
            role: userTableRole,
            status: "active",
          },
          { onConflict: "id" }
        )
    } catch {
      // best-effort; insert may still succeed
    }

    const { error: eventError } = await supabase.from("events").insert({
      team_id: teamId,
      /** Same as manual "Other" events — calendar UI classifies CUSTOM under Other. */
      event_type: "CUSTOM",
      title: eventTitle,
      description: noteVal,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      location: null,
      visibility: "COACHES_ONLY",
      created_by: session.user.id,
      linked_follow_up_id: insertedRow.id,
    })

    if (eventError) {
      console.error("[POST /api/roster/.../follow-ups] calendar insert failed", eventError.message)
      await supabase.from("player_follow_ups").delete().eq("id", insertedRow.id)
      return NextResponse.json({ error: "Follow-up saved but calendar event failed. Try again." }, { status: 500 })
    }

    await logPlayerProfileActivity({
      playerId,
      teamId,
      actorId: session.user.id,
      actionType: "follow_up_created",
      targetType: "follow_up",
      targetId: insertedRow.id,
      metadata: { category },
    })

    revalidateTeamCalendar(teamId)

    return NextResponse.json(inserted)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/roster/.../follow-ups]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
