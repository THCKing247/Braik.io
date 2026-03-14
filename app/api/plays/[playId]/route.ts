import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

const VALID_PLAY_TYPES = ["run", "pass", "rpo", "screen"] as const

const PLAY_SELECT_FULL =
  "id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, canvas_data, play_type, order_index, tags, created_at, updated_at"
const PLAY_SELECT_BASE =
  "id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, canvas_data, created_at, updated_at"

function isColumnError(err: { message?: string; code?: string }): boolean {
  const code = err?.code
  const msg = typeof err?.message === "string" ? err.message : ""
  return code === "42703" || msg.includes("order_index") || msg.includes("tags") || msg.includes("play_type") || msg.includes("does not exist")
}

function safePlayTypeFromRow(row: Record<string, unknown> | null): (typeof VALID_PLAY_TYPES)[number] | null {
  if (!row) return null
  const raw = row.play_type
  if (typeof raw !== "string" || !VALID_PLAY_TYPES.includes(raw as (typeof VALID_PLAY_TYPES)[number])) return null
  return raw as (typeof VALID_PLAY_TYPES)[number]
}

/**
 * GET /api/plays/[playId]
 * Returns a single play by ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playId: string }> }
) {
  const logMeta: { playId?: string; rowFound?: boolean; team_id?: string; accessCheck?: string; message?: string; code?: string; stack?: string } = {}
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playId: rawPlayId } = await params
    const playId = typeof rawPlayId === "string" ? rawPlayId.trim() : ""
    logMeta.playId = playId || undefined

    if (!playId) {
      console.log("[GET /api/plays/[playId]]", { ...logMeta, message: "playId missing" })
      return NextResponse.json({ error: "playId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    let play: Record<string, unknown> | null = null
    let playError: { message?: string; code?: string } | null = null

    let result = await supabase
      .from("plays")
      .select(PLAY_SELECT_FULL)
      .eq("id", playId)
      .maybeSingle()

    play = result.data as Record<string, unknown> | null
    playError = result.error as { message?: string; code?: string } | null

    if (result.error && isColumnError(result.error as { message?: string; code?: string })) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[GET /api/plays/[playId]]", { playId, message: "Full select failed (column missing), trying base select", code: (result.error as { code?: string }).code })
      }
      const fallback = await supabase
        .from("plays")
        .select(PLAY_SELECT_BASE)
        .eq("id", playId)
        .maybeSingle()
      play = fallback.data as Record<string, unknown> | null
      playError = fallback.error as { message?: string; code?: string } | null
    }

    logMeta.rowFound = !!play
    if (play) logMeta.team_id = play.team_id as string

    if (playError && !play) {
      console.error("[GET /api/plays/[playId]]", {
        ...logMeta,
        message: playError.message ?? "Database error",
        code: playError.code,
      })
      return NextResponse.json(
        { error: "Failed to load play" },
        { status: 500 }
      )
    }

    if (!play) {
      console.log("[GET /api/plays/[playId]]", { ...logMeta, message: "Play not found (no row)" })
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    try {
      await requireTeamAccess(play.team_id as string)
      logMeta.accessCheck = "allowed"
    } catch (accessErr) {
      const msg = accessErr instanceof Error ? accessErr.message : "Access denied"
      logMeta.accessCheck = "denied"
      logMeta.message = msg
      console.log("[GET /api/plays/[playId]]", logMeta)
      return NextResponse.json(
        { error: msg },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[GET /api/plays/[playId]]", logMeta)
    }

    const subFormationId = (play.sub_formation_id as string) ?? null
    let subFormationName: string | null = null
    if (subFormationId) {
      const { data: subRow } = await supabase.from("sub_formations").select("name").eq("id", subFormationId).maybeSingle()
      subFormationName = subRow?.name?.trim() ?? null
    }

    const res = NextResponse.json({
      id: play.id,
      teamId: play.team_id,
      playbookId: play.playbook_id ?? null,
      formationId: play.formation_id ?? null,
      subFormationId,
      side: play.side,
      formation: play.formation,
      subFormation: subFormationName,
      subcategory: play.subcategory ?? null,
      name: play.name,
      playType: safePlayTypeFromRow(play),
      canvasData: play.canvas_data,
      orderIndex: play.order_index ?? null,
      tags: Array.isArray(play.tags) ? play.tags : null,
      createdAt: play.created_at,
      updatedAt: play.updated_at,
    })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string }
    console.error("[GET /api/plays/[playId]]", {
      ...logMeta,
      message: err?.message,
      stack: err?.stack,
    })
    return NextResponse.json(
      { error: err?.message ?? "Failed to load play" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/** Build base update payload (columns that exist in original plays migration). */
function buildBaseUpdatePayload(
  body: {
    name?: string
    canvasData?: unknown
    formation?: string
    formationId?: string | null
    subFormationId?: string | null
    subcategory?: string | null
    side?: string
  },
  formationNameFromId?: string | null
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (body.name !== undefined) updateData.name = body.name.trim()
  if (body.canvasData !== undefined) updateData.canvas_data = body.canvasData
  if (body.formation !== undefined) updateData.formation = body.formation.trim()
  if (body.formationId !== undefined) {
    updateData.formation_id = body.formationId
    if (formationNameFromId != null) updateData.formation = formationNameFromId
  }
  if (body.subFormationId !== undefined) updateData.sub_formation_id = body.subFormationId
  if (body.subcategory !== undefined) updateData.subcategory = body.subcategory?.trim() ?? null
  if (body.side !== undefined) updateData.side = body.side
  return updateData
}

/**
 * PATCH /api/plays/[playId]
 * Updates a play. Schema-safe: tries full payload/select first, falls back to base-only if optional columns are missing.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playId: string }> }
) {
  const debugId = crypto.randomUUID()
  const logMeta: {
    phase?: string
    playId?: string
    bodyKeys?: string[]
    updatePayloadKeys?: string[]
    fallbackUsed?: boolean
    message?: string
    code?: string
    stack?: string
  } = { playId: undefined }

  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playId } = await params
    const id = typeof playId === "string" ? playId.trim() : ""
    logMeta.playId = id || undefined

    if (!id) {
      console.log("[PATCH /api/plays/[playId]]", { debugId, phase: "parse", ...logMeta, message: "playId missing" })
      return NextResponse.json(
        { error: "playId is required", debugId, phase: "parse" },
        { status: 400 }
      )
    }

    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      console.log("[PATCH /api/plays/[playId]]", { debugId, phase: "parse", playId: id, message: "Invalid JSON" })
      return NextResponse.json(
        { error: "Invalid JSON body", debugId, phase: "parse" },
        { status: 400 }
      )
    }
    logMeta.bodyKeys = Object.keys(body)
    logMeta.phase = "access"

    const supabase = getSupabaseServer()

    const { data: existingPlay, error: existingError } = await supabase
      .from("plays")
      .select("id, team_id, side")
      .eq("id", id)
      .maybeSingle()

    if (existingError) {
      console.error("[PATCH /api/plays/[playId]]", { debugId, phase: "access", playId: id, message: existingError.message, code: (existingError as { code?: string }).code })
      return NextResponse.json(
        {
          error: "Failed to load play",
          debugId,
          phase: "access",
          ...(process.env.NODE_ENV !== "production" && { details: (existingError as { message?: string }).message }),
        },
        { status: 500 }
      )
    }
    if (!existingPlay) {
      console.log("[PATCH /api/plays/[playId]]", { debugId, phase: "access", playId: id, message: "Play not found" })
      return NextResponse.json({ error: "Play not found", debugId, phase: "access" }, { status: 404 })
    }

    const side = (body.side as string) || existingPlay.side
    try {
      if (side === "offense") {
        await requireTeamPermission(existingPlay.team_id, "edit_offense_plays")
      } else if (side === "defense") {
        await requireTeamPermission(existingPlay.team_id, "edit_defense_plays")
      } else {
        await requireTeamPermission(existingPlay.team_id, "edit_special_teams_plays")
      }
    } catch (accessErr) {
      const msg = accessErr instanceof Error ? accessErr.message : "Access denied"
      console.log("[PATCH /api/plays/[playId]]", { debugId, phase: "access", playId: id, message: msg })
      return NextResponse.json(
        { error: msg, debugId, phase: "access" },
        { status: 403 }
      )
    }

    let formationNameForInsert: string | null = null
    if (body.formationId != null && body.formationId !== "") {
      const { data: formationRow } = await supabase
        .from("formations")
        .select("name")
        .eq("id", body.formationId)
        .eq("team_id", existingPlay.team_id)
        .maybeSingle()
      formationNameForInsert = formationRow?.name?.trim() ?? null
    }

    const basePayload = buildBaseUpdatePayload(
      {
        name: body.name as string | undefined,
        canvasData: body.canvasData,
        formation: body.formation as string | undefined,
        formationId: body.formationId as string | null | undefined,
        subFormationId: body.subFormationId as string | null | undefined,
        subcategory: body.subcategory as string | null | undefined,
        side: body.side as string | undefined,
      },
      formationNameForInsert
    )

    const fullPayload = { ...basePayload } as Record<string, unknown>
    if (body.tags !== undefined) {
      fullPayload.tags = Array.isArray(body.tags)
        ? (body.tags as unknown[]).filter((t): t is string => typeof t === "string" && t.trim() !== "")
        : null
    }
    if (body.playType !== undefined && body.playType !== null) {
      const pt = body.playType as string
      if (typeof pt === "string" && ["run", "pass", "rpo", "screen"].includes(pt)) {
        fullPayload.play_type = pt
      }
    }

    logMeta.phase = "update"
    logMeta.updatePayloadKeys = Object.keys(fullPayload)

    let play: Record<string, unknown> | null = null
    let usedBaseSelect = false

    let updateResult = await supabase
      .from("plays")
      .update(fullPayload)
      .eq("id", id)
      .select(PLAY_SELECT_FULL)
      .single()

    if (updateResult.error && isColumnError(updateResult.error as { message?: string; code?: string })) {
      logMeta.fallbackUsed = true
      if (process.env.NODE_ENV !== "production") {
        console.log("[PATCH /api/plays/[playId]]", {
          debugId,
          phase: "update",
          playId: id,
          message: "Full update/select failed (optional column), retrying with base payload and base select",
          code: (updateResult.error as { code?: string }).code,
        })
      }
      const baseUpdateResult = await supabase
        .from("plays")
        .update(basePayload)
        .eq("id", id)
        .select(PLAY_SELECT_BASE)
        .single()
      if (baseUpdateResult.error) {
        console.error("[PATCH /api/plays/[playId]]", {
          debugId,
          phase: "update",
          playId: id,
          fallbackUsed: true,
          message: (baseUpdateResult.error as { message?: string }).message,
          code: (baseUpdateResult.error as { code?: string }).code,
        })
        return NextResponse.json(
          {
            error: "Failed to update play",
            debugId,
            phase: "update",
            ...(process.env.NODE_ENV !== "production" && { details: (baseUpdateResult.error as { message?: string }).message }),
          },
          { status: 500 }
        )
      }
      play = baseUpdateResult.data as Record<string, unknown>
      usedBaseSelect = true
    } else if (updateResult.error) {
      console.error("[PATCH /api/plays/[playId]]", {
        debugId,
        phase: "update",
        playId: id,
        message: (updateResult.error as { message?: string }).message,
        code: (updateResult.error as { code?: string }).code,
      })
      return NextResponse.json(
        {
          error: "Failed to update play",
          debugId,
          phase: "update",
          ...(process.env.NODE_ENV !== "production" && { details: (updateResult.error as { message?: string }).message }),
        },
        { status: 500 }
      )
    } else {
      play = updateResult.data as Record<string, unknown>
    }

    if (!play) {
      return NextResponse.json(
        { error: "Failed to update play", debugId, phase: "select" },
        { status: 500 }
      )
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[PATCH /api/plays/[playId]]", { debugId, phase: "response_format", playId: id, fallbackUsed: logMeta.fallbackUsed })
    }

    const subFormationId = (play.sub_formation_id as string) ?? null
    let subFormationName: string | null = null
    if (subFormationId) {
      const { data: subRow } = await supabase.from("sub_formations").select("name").eq("id", subFormationId).maybeSingle()
      subFormationName = subRow?.name?.trim() ?? null
    }

    const res = NextResponse.json({
      id: play.id,
      teamId: play.team_id,
      playbookId: play.playbook_id ?? null,
      formationId: play.formation_id ?? null,
      subFormationId,
      side: play.side,
      formation: play.formation,
      subFormation: subFormationName,
      subcategory: play.subcategory ?? null,
      name: play.name,
      playType: usedBaseSelect ? null : safePlayTypeFromRow(play),
      canvasData: play.canvas_data,
      orderIndex: usedBaseSelect ? null : (play.order_index ?? null),
      tags: usedBaseSelect ? null : (Array.isArray(play.tags) ? play.tags : null),
      createdAt: play.created_at,
      updatedAt: play.updated_at,
    })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string }
    console.error("[PATCH /api/plays/[playId]]", {
      debugId,
      phase: "response_error",
      ...logMeta,
      message: err?.message,
      stack: err?.stack,
    })
    return NextResponse.json(
      {
        error: err?.message ?? "Failed to update play",
        debugId,
        phase: "response_error",
        ...(process.env.NODE_ENV !== "production" && err?.stack && { details: err.stack }),
      },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/plays/[playId]
 * Deletes a play. Formations are not modified or auto-deleted (they are first-class records).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ playId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playId } = await params
    if (!playId) {
      return NextResponse.json({ error: "playId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Get existing play to check permissions
    const { data: existingPlay, error: existingError } = await supabase
      .from("plays")
      .select("id, team_id, side")
      .eq("id", playId)
      .maybeSingle()

    if (existingError || !existingPlay) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    // Check permissions based on side
    if (existingPlay.side === "offense") {
      await requireTeamPermission(existingPlay.team_id, "edit_offense_plays")
    } else if (existingPlay.side === "defense") {
      await requireTeamPermission(existingPlay.team_id, "edit_defense_plays")
    } else {
      await requireTeamPermission(existingPlay.team_id, "edit_special_teams_plays")
    }

    // Delete play
    const { error: deleteError } = await supabase.from("plays").delete().eq("id", playId)

    if (deleteError) {
      console.error("[DELETE /api/plays/[playId]]", deleteError)
      return NextResponse.json({ error: "Failed to delete play" }, { status: 500 })
    }

    const res = NextResponse.json({ success: true })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[DELETE /api/plays/[playId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete play" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
