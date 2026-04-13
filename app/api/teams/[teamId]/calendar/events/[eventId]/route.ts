import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership } from "@/lib/auth/rbac"
import { requireTeamPermission } from "@/lib/auth/rbac"
import { requireBillingPermission } from "@/lib/billing/billing-state"
import { TeamOperationBlockedError, requireTeamOperationAccess, toStructuredTeamAccessError } from "@/lib/enforcement/team-operation-guard"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { revalidateTeamCalendar, revalidateTeamDashboardBootstrap } from "@/lib/cache/lightweight-get-cache"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const eventTypeMap: Record<string, string> = {
  practice: "PRACTICE",
  game: "GAME",
  meeting: "MEETING",
  follow_up: "CUSTOM",
  other: "CUSTOM",
}

const visibilityMap: Record<string, string> = {
  all: "PARENTS_AND_TEAM",
  players: "TEAM",
  parents: "PARENTS_AND_TEAM",
  staff: "COACHES_ONLY",
}

type AuthResult =
  | { error: NextResponse }
  | { session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>; userId: string }

async function requireCalendarWriteAccess(teamId: string, request: Request): Promise<AuthResult> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  try {
    await requireTeamPermission(teamId, "post_announcements")
    await requireTeamOperationAccess(teamId, "write")
    const { auditImpersonatedActionFromRequest } = await import("@/lib/admin/impersonation")
    await auditImpersonatedActionFromRequest(request, "event_mutate", { teamId })
    await requireBillingPermission(teamId, "editEvents")
  } catch (e) {
    if (e instanceof TeamOperationBlockedError) {
      return { error: NextResponse.json(toStructuredTeamAccessError(e), { status: e.statusCode }) }
    }
    const message = e instanceof Error ? e.message : "Unknown error"
    const isPermissionDenied =
      message.includes("Forbidden") || message.includes("Not a member") || message.includes("Access denied")
    if (isPermissionDenied) {
      return {
        error: NextResponse.json(
          {
            error: {
              code: "PERMISSION_DENIED",
              message: "You do not have permission to change events for this team.",
              teamId,
              operation: "write",
            },
          },
          { status: 403 }
        ),
      }
    }
    return {
      error: NextResponse.json({ error: "Access check failed", message }, { status: 500 }),
    }
  }
  return { session, userId: session.user.id }
}

type ExistingEvent = {
  id: string
  team_id: string
  linked_follow_up_id: string | null
  linked_game_id: string | null
  linked_injury_id: string | null
}

async function loadEventForTeam(
  supabase: ReturnType<typeof getSupabaseServer>,
  teamId: string,
  eventId: string
): Promise<{ ok: true; row: ExistingEvent } | { ok: false; status: number; body: unknown }> {
  const { data, error } = await supabase
    .from("events")
    .select("id, team_id, linked_follow_up_id, linked_game_id, linked_injury_id")
    .eq("id", eventId)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, body: { error: "Failed to load event", message: error.message } }
  }
  if (!data || data.team_id !== teamId) {
    return { ok: false, status: 404, body: { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } } }
  }
  return { ok: true, row: data as ExistingEvent }
}

function linkedEventError(code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status: 409 })
}

/**
 * PATCH /api/teams/[teamId]/calendar/events/[eventId]
 * Body mirrors POST /calendar/events (partial fields allowed).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params
    if (!teamId || !eventId) {
      return NextResponse.json({ error: "teamId and eventId are required" }, { status: 400 })
    }

    const auth = await requireCalendarWriteAccess(teamId, request)
    if ("error" in auth) return auth.error

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid JSON"
      return NextResponse.json({ error: "Invalid body", message }, { status: 400 })
    }
    const body = rawBody as Record<string, unknown>

    const supabase = getSupabaseServer()

    const existing = await loadEventForTeam(supabase, teamId, eventId)
    if (!existing.ok) return NextResponse.json(existing.body, { status: existing.status })

    const row = existing.row
    if (row.linked_game_id) {
      return linkedEventError(
        "EVENT_LINKED_TO_GAME",
        "This event is tied to a scheduled game. Edit the game from Schedule / Games to change date, opponent, or location."
      )
    }
    if (row.linked_follow_up_id) {
      return linkedEventError(
        "EVENT_LINKED_TO_FOLLOW_UP",
        "This event is linked to a player follow-up. Manage it from the roster follow-up, not the calendar editor."
      )
    }
    if (row.linked_injury_id) {
      return linkedEventError(
        "EVENT_LINKED_TO_INJURY",
        "This event is linked to an injury timeline. Update it from the injury record, not here."
      )
    }

    const patch: Record<string, unknown> = {}

    if (typeof body.title === "string") {
      const t = body.title.trim()
      if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 })
      patch.title = t
    }

    const startVal = body.start ?? body.startAt
    const endVal = body.end ?? body.endAt
    if (startVal !== undefined) {
      if (typeof startVal !== "string" && typeof startVal !== "number") {
        return NextResponse.json({ error: "start must be a string or number" }, { status: 400 })
      }
      patch.start = typeof startVal === "string" ? new Date(startVal).toISOString() : new Date(startVal).toISOString()
    }
    if (endVal !== undefined) {
      if (typeof endVal !== "string" && typeof endVal !== "number") {
        return NextResponse.json({ error: "end must be a string or number" }, { status: 400 })
      }
      patch.end = typeof endVal === "string" ? new Date(endVal).toISOString() : new Date(endVal).toISOString()
    }

    if (typeof body.type === "string") {
      const typeStr = body.type
      patch.event_type = eventTypeMap[typeStr] || "CUSTOM"
    }

    if (typeof body.audience === "string") {
      patch.visibility = visibilityMap[body.audience] || "TEAM"
    }

    if (body.notes !== undefined) {
      patch.description = typeof body.notes === "string" ? body.notes : null
    }

    if (body.location !== undefined) {
      patch.location = typeof body.location === "string" ? body.location : null
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    if (patch.start !== undefined || patch.end !== undefined) {
      const { data: cur } = await supabase.from("events").select("start, end").eq("id", eventId).single()
      const s = (patch.start as string | undefined) ?? (cur?.start as string | undefined)
      const e = (patch.end as string | undefined) ?? (cur?.end as string | undefined)
      if (s && e && new Date(e) <= new Date(s)) {
        return NextResponse.json({ error: "End time must be after start time." }, { status: 400 })
      }
    }

    patch.updated_at = new Date().toISOString()

    const { data: updated, error: upErr } = await supabase
      .from("events")
      .update(patch)
      .eq("id", eventId)
      .eq("team_id", teamId)
      .select()
      .single()

    if (upErr || !updated) {
      console.error("[PATCH calendar event]", upErr)
      return NextResponse.json({ error: "Update failed", message: upErr?.message ?? "unknown" }, { status: 500 })
    }

    try {
      const { writeAuditLog } = await import("@/lib/audit/write-audit-log")
      await writeAuditLog({
        actorUserId: auth.userId,
        teamId,
        actionType: "event_updated",
        targetType: "event",
        targetId: eventId,
        metadata: { title: (updated as { title?: string }).title },
      })
      const membership = await getUserMembership(teamId)
      const { logEventAction } = await import("@/lib/audit/structured-logger")
      logEventAction("event_updated", {
        userId: auth.userId,
        teamId,
        role: membership?.role,
        eventId,
      })
    } catch {
      /* non-fatal */
    }

    revalidateTeamCalendar(teamId)
    revalidateTeamDashboardBootstrap(teamId)

    return NextResponse.json(updated)
  } catch (e) {
    console.error("[PATCH /calendar/events/[eventId]]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/teams/[teamId]/calendar/events/[eventId]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params
    if (!teamId || !eventId) {
      return NextResponse.json({ error: "teamId and eventId are required" }, { status: 400 })
    }

    const auth = await requireCalendarWriteAccess(teamId, request)
    if ("error" in auth) return auth.error

    const supabase = getSupabaseServer()

    const existing = await loadEventForTeam(supabase, teamId, eventId)
    if (!existing.ok) return NextResponse.json(existing.body, { status: existing.status })

    const row = existing.row
    if (row.linked_game_id) {
      return linkedEventError(
        "EVENT_LINKED_TO_GAME",
        "Remove or edit this entry from Schedule / Games instead of deleting it from the calendar."
      )
    }
    if (row.linked_follow_up_id) {
      return linkedEventError(
        "EVENT_LINKED_TO_FOLLOW_UP",
        "This calendar entry is linked to a player follow-up and cannot be deleted here."
      )
    }
    if (row.linked_injury_id) {
      return linkedEventError(
        "EVENT_LINKED_TO_INJURY",
        "This event is linked to an injury record and cannot be deleted from the calendar."
      )
    }

    const userTableRole = profileRoleToUserRole((auth.session.user.role ?? "user").toLowerCase())
    try {
      await supabase.from("users").upsert(
        {
          id: auth.userId,
          email: auth.session.user.email,
          name: auth.session.user.name ?? null,
          role: userTableRole,
          status: "active",
        },
        { onConflict: "id" }
      )
    } catch {
      /* best-effort */
    }

    const { error: delErr } = await supabase.from("events").delete().eq("id", eventId).eq("team_id", teamId)

    if (delErr) {
      console.error("[DELETE calendar event]", delErr)
      return NextResponse.json({ error: "Delete failed", message: delErr.message }, { status: 500 })
    }

    try {
      const { writeAuditLog } = await import("@/lib/audit/write-audit-log")
      await writeAuditLog({
        actorUserId: auth.userId,
        teamId,
        actionType: "event_deleted",
        targetType: "event",
        targetId: eventId,
        metadata: {},
      })
    } catch {
      /* non-fatal */
    }

    revalidateTeamCalendar(teamId)
    revalidateTeamDashboardBootstrap(teamId)

    return NextResponse.json({ ok: true, id: eventId })
  } catch (e) {
    console.error("[DELETE /calendar/events/[eventId]]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
