import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function isValidUuid(s: string): boolean {
  return s.length > 0 && UUID_REGEX.test(s)
}

function isColumnError(err: { message?: string; code?: string }): boolean {
  const code = err?.code
  const msg = typeof err?.message === "string" ? err.message : ""
  return code === "42703" || msg.includes("order_index") || msg.includes("does not exist")
}

/**
 * PATCH /api/plays/reorder
 * Body: { items: Array<{ id: string, orderIndex: number }> }
 * Updates order_index for each play. All plays must belong to the same team and same parent scope.
 * When order_index column is missing (schema not migrated), returns 200 with reorderApplied: false
 * so the client does not get a 500.
 */
export async function PATCH(request: Request) {
  const debugId = crypto.randomUUID()
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const items = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json(
        { error: "items array is required", debugId, phase: "parse" },
        { status: 400 }
      )
    }

    const parsed = items
      .map((x: unknown) => {
        if (x && typeof x === "object" && "id" in x && "orderIndex" in x) {
          const id = String((x as { id: unknown }).id)
          const orderIndex = Number((x as { orderIndex: unknown }).orderIndex)
          if (isValidUuid(id) && Number.isInteger(orderIndex) && orderIndex >= 0) return { id, orderIndex }
        }
        return null
      })
      .filter((x): x is { id: string; orderIndex: number } => x != null)

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "Valid items (id, orderIndex) required", debugId, phase: "parse" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    const playIds = parsed.map((p) => p.id)

    const { data: plays, error: fetchError } = await supabase
      .from("plays")
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side")
      .in("id", playIds)

    if (fetchError) {
      console.error("[PATCH /api/plays/reorder]", { debugId, phase: "fetch", message: fetchError.message, code: (fetchError as { code?: string }).code })
      return NextResponse.json(
        {
          error: "Failed to load plays",
          debugId,
          phase: "fetch",
          ...(process.env.NODE_ENV !== "production" && { details: (fetchError as { message?: string }).message }),
        },
        { status: 500 }
      )
    }
    if (!plays?.length) {
      return NextResponse.json({ error: "Plays not found", debugId, phase: "fetch" }, { status: 404 })
    }

    const teamId = plays[0].team_id
    const playbookId = plays[0].playbook_id ?? null
    const formationId = (plays[0] as { formation_id?: string }).formation_id ?? null

    const sameScope = plays.every(
      (p) =>
        p.team_id === teamId &&
        (p.playbook_id ?? null) === playbookId &&
        ((p as { formation_id?: string }).formation_id ?? null) === formationId
    )
    if (!sameScope) {
      return NextResponse.json(
        { error: "All plays must be in the same playbook/formation", debugId, phase: "scope" },
        { status: 400 }
      )
    }

    if (plays.length !== playIds.length) {
      return NextResponse.json({ error: "Some play ids not found", debugId, phase: "fetch" }, { status: 404 })
    }

    const side = plays[0].side as string
    try {
      if (side === "offense") {
        await requireTeamPermission(teamId, "edit_offense_plays")
      } else if (side === "defense") {
        await requireTeamPermission(teamId, "edit_defense_plays")
      } else {
        await requireTeamPermission(teamId, "edit_special_teams_plays")
      }
    } catch (accessErr) {
      const msg = accessErr instanceof Error ? accessErr.message : "Access denied"
      console.log("[PATCH /api/plays/reorder]", { debugId, phase: "access", playIds: playIds.length, message: msg })
      return NextResponse.json({ error: msg, debugId, phase: "access" }, { status: 403 })
    }

    // Probe first update: if order_index column is missing, we get a column error and skip persisting
    const first = parsed[0]
    const { error: probeError } = await supabase
      .from("plays")
      .update({ order_index: first.orderIndex, updated_at: new Date().toISOString() })
      .eq("id", first.id)

    if (probeError && isColumnError(probeError as { message?: string; code?: string })) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[PATCH /api/plays/reorder]", {
          debugId,
          phase: "update",
          message: "order_index column missing, reorder not applied",
          code: (probeError as { code?: string }).code,
        })
      }
      const res = NextResponse.json({ success: true, reorderApplied: false })
      if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
      return res
    }

    if (probeError) {
      console.error("[PATCH /api/plays/reorder]", {
        debugId,
        phase: "update",
        message: (probeError as { message?: string }).message,
        code: (probeError as { code?: string }).code,
      })
      return NextResponse.json(
        {
          error: "Could not reorder plays",
          debugId,
          phase: "update",
          ...(process.env.NODE_ENV !== "production" && { details: (probeError as { message?: string }).message }),
        },
        { status: 500 }
      )
    }

    for (let i = 1; i < parsed.length; i++) {
      const { id, orderIndex } = parsed[i]
      const { error: updateError } = await supabase
        .from("plays")
        .update({ order_index: orderIndex, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (updateError) {
        console.error("[PATCH /api/plays/reorder]", {
          debugId,
          phase: "update",
          playId: id,
          message: (updateError as { message?: string }).message,
          code: (updateError as { code?: string }).code,
        })
        return NextResponse.json(
          {
            error: "Could not reorder plays",
            debugId,
            phase: "update",
            ...(process.env.NODE_ENV !== "production" && { details: (updateError as { message?: string }).message }),
          },
          { status: 500 }
        )
      }
    }

    const res = NextResponse.json({ success: true, reorderApplied: true })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string }
    console.error("[PATCH /api/plays/reorder]", {
      debugId,
      phase: "response_error",
      message: err?.message,
      stack: err?.stack,
    })
    return NextResponse.json(
      {
        error: err?.message ?? "Could not reorder plays",
        debugId,
        phase: "response_error",
        ...(process.env.NODE_ENV !== "production" && err?.stack && { details: err.stack }),
      },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
