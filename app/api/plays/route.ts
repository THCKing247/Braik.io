import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

const LOG_PREFIX = "[api/plays][POST]"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function safeString(val: unknown): string | undefined {
  if (val == null) return undefined
  if (typeof val === "string") return val
  return undefined
}

function safeObject(val: unknown): Record<string, unknown> | null {
  if (val == null) return null
  if (typeof val === "object" && !Array.isArray(val) && val !== null) return val as Record<string, unknown>
  return null
}

function isValidUuid(s: string): boolean {
  return s.length > 0 && UUID_REGEX.test(s)
}

/**
 * GET /api/plays?teamId=xxx&side=xxx
 * Returns plays for the team, optionally filtered by side.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const side = searchParams.get("side")

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    let query = supabase
      .from("plays")
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, play_type, canvas_data, created_at, updated_at")
      .eq("team_id", teamId)

    if (side) {
      query = query.eq("side", side)
    }

    const { data: plays, error: playsError } = await query.order("formation", { ascending: true }).order("name", { ascending: true })

    if (playsError) {
      console.error("[GET /api/plays]", playsError)
      return NextResponse.json({ error: "Failed to load plays" }, { status: 500 })
    }

    const subFormationIds = [...new Set((plays ?? []).map((p) => (p as { sub_formation_id?: string }).sub_formation_id).filter(Boolean))] as string[]
    const subFormationNameMap = new Map<string, string>()
    if (subFormationIds.length > 0) {
      const { data: subRows } = await supabase.from("sub_formations").select("id, name").in("id", subFormationIds)
      subRows?.forEach((r) => subFormationNameMap.set(r.id, r.name?.trim() ?? ""))
    }

    const formatted = (plays ?? []).map((p) => {
      const sfId = (p as { sub_formation_id?: string }).sub_formation_id ?? null
      const playType = (p as { play_type?: string | null }).play_type ?? null
      return {
        id: p.id,
        teamId: p.team_id,
        playbookId: p.playbook_id ?? null,
        formationId: (p as { formation_id?: string }).formation_id ?? null,
        subFormationId: sfId,
        side: p.side,
        formation: p.formation,
        subFormation: sfId ? subFormationNameMap.get(sfId) ?? null : null,
        subcategory: p.subcategory ?? null,
        name: p.name,
        playType: playType && ["run", "pass", "rpo", "screen"].includes(playType) ? playType : null,
        canvasData: p.canvas_data,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }
    })

    const res = NextResponse.json(formatted)
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/plays]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load plays" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

const VALID_SIDES = ["offense", "defense", "special_teams"] as const
const VALID_PLAY_TYPES = ["run", "pass", "rpo", "screen"] as const

/**
 * POST /api/plays
 * Creates a new play.
 */
export async function POST(request: Request) {
  try {
    console.log(`${LOG_PREFIX} request received`)

    const session = await getServerSession()
    if (!session?.user?.id) {
      console.log(`${LOG_PREFIX} unauthenticated`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.log(`${LOG_PREFIX} authenticated user: ${session.user.id}`)

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      console.log(`${LOG_PREFIX} invalid JSON body`)
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const body = typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : {}
    console.log(`${LOG_PREFIX} parsed body keys: ${Object.keys(body).join(", ")}`)

    const teamId = safeString(body.teamId)
    const playbookId = body.playbookId != null ? safeString(body.playbookId) ?? null : null
    const formationId = body.formationId != null ? safeString(body.formationId) ?? null : null
    const subFormationId = body.subFormationId != null ? safeString(body.subFormationId) ?? null : null
    const side = safeString(body.side)
    const formation = safeString(body.formation)
    const subcategory = body.subcategory != null ? safeString(body.subcategory) ?? null : null
    const name = safeString(body.name)
    const playTypeRaw = safeString(body.playType)
    const playType =
      playTypeRaw && VALID_PLAY_TYPES.includes(playTypeRaw as (typeof VALID_PLAY_TYPES)[number])
        ? (playTypeRaw as (typeof VALID_PLAY_TYPES)[number])
        : null
    const canvasData = body.canvasData !== undefined ? (safeObject(body.canvasData) ?? body.canvasData) : undefined

    const normalized = {
      teamId,
      playbookId,
      formationId,
      subFormationId,
      side,
      formation: formation?.trim() ?? "",
      subcategory,
      name: name?.trim() ?? "",
      playType,
      hasCanvasData: canvasData !== undefined,
    }
    console.log(`${LOG_PREFIX} normalized payload:`, JSON.stringify(normalized))

    if (!teamId) {
      console.log(`${LOG_PREFIX} validation failed: missing teamId`)
      return NextResponse.json({ error: "Missing teamId" }, { status: 400 })
    }
    if (!isValidUuid(teamId)) {
      console.log(`${LOG_PREFIX} validation failed: teamId is not a valid UUID`)
      return NextResponse.json({ error: "teamId must be a valid UUID" }, { status: 400 })
    }
    if (!side || !VALID_SIDES.includes(side as (typeof VALID_SIDES)[number])) {
      console.log(`${LOG_PREFIX} validation failed: invalid or missing side`)
      return NextResponse.json(
        { error: "side must be offense, defense, or special_teams" },
        { status: 400 }
      )
    }
    if (!normalized.name) {
      console.log(`${LOG_PREFIX} validation failed: missing play name/title`)
      return NextResponse.json({ error: "Missing play name/title" }, { status: 400 })
    }
    if (formationId != null && formationId !== "" && !isValidUuid(formationId)) {
      console.log(`${LOG_PREFIX} validation failed: formationId is not a valid UUID`)
      return NextResponse.json({ error: "formationId must be a valid UUID" }, { status: 400 })
    }
    if (subFormationId != null && subFormationId !== "" && !isValidUuid(subFormationId)) {
      console.log(`${LOG_PREFIX} validation failed: subFormationId is not a valid UUID`)
      return NextResponse.json({ error: "subFormationId must be a valid UUID" }, { status: 400 })
    }
    if (playbookId != null && playbookId !== "" && !isValidUuid(playbookId)) {
      console.log(`${LOG_PREFIX} validation failed: playbookId is not a valid UUID`)
      return NextResponse.json({ error: "playbookId must be a valid UUID" }, { status: 400 })
    }

    console.log(`${LOG_PREFIX} validation pass`)

    try {
      if (side === "offense") {
        await requireTeamPermission(teamId, "edit_offense_plays")
      } else if (side === "defense") {
        await requireTeamPermission(teamId, "edit_defense_plays")
      } else {
        await requireTeamPermission(teamId, "edit_special_teams_plays")
      }
    } catch (permErr) {
      console.error(`${LOG_PREFIX} permission check failed`, permErr)
      const msg = permErr instanceof Error ? permErr.message : "Access denied"
      return NextResponse.json({ error: msg }, { status: 403 })
    }

    const supabase = getSupabaseServer()

    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      console.log(`${LOG_PREFIX} team not found: ${teamId}`)
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    if (playbookId) {
      const { data: playbook } = await supabase
        .from("playbooks")
        .select("id")
        .eq("id", playbookId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!playbook) {
        console.log(`${LOG_PREFIX} playbook not found: ${playbookId}`)
        return NextResponse.json({ error: "Playbook not found" }, { status: 404 })
      }
    }

    let formationNameForInsert = normalized.formation
    if (formationId) {
      const { data: formationRow } = await supabase
        .from("formations")
        .select("id, name")
        .eq("id", formationId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!formationRow) {
        console.log(`${LOG_PREFIX} formation not found: ${formationId}`)
        return NextResponse.json({ error: "Formation not found" }, { status: 404 })
      }
      formationNameForInsert = formationRow.name?.trim() ?? formationNameForInsert
    }
    if (!formationNameForInsert) {
      console.log(`${LOG_PREFIX} validation failed: formation name required (formation or formationId)`)
      return NextResponse.json({ error: "formation is required (provide formation name or formationId)" }, { status: 400 })
    }

    let subFormationNameForInsert: string | null = null
    if (subFormationId) {
      const { data: subRow } = await supabase
        .from("sub_formations")
        .select("id, name, formation_id")
        .eq("id", subFormationId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!subRow) {
        console.log(`${LOG_PREFIX} sub-formation not found: ${subFormationId}`)
        return NextResponse.json({ error: "Sub-formation not found" }, { status: 404 })
      }
      if (formationId && subRow.formation_id !== formationId) {
        console.log(`${LOG_PREFIX} sub-formation does not belong to formation`)
        return NextResponse.json(
          { error: "Sub-formation does not belong to the given formation" },
          { status: 400 }
        )
      }
      subFormationNameForInsert = subRow.name?.trim() ?? null
    }

    const insertPayload: Record<string, unknown> = {
      team_id: teamId,
      playbook_id: playbookId && playbookId.trim() !== "" ? playbookId : null,
      side,
      formation: formationNameForInsert,
      subcategory: subcategory ?? null,
      name: normalized.name,
      canvas_data: canvasData ?? null,
    }
    if (formationId != null && formationId.trim() !== "") {
      insertPayload.formation_id = formationId
    }
    if (subFormationId != null && subFormationId.trim() !== "") {
      insertPayload.sub_formation_id = subFormationId
    }
    if (playType != null) {
      insertPayload.play_type = playType
    }

    console.log(`${LOG_PREFIX} insert attempt: team_id, formation, name present`)

    const { data: play, error: playError } = await supabase
      .from("plays")
      .insert(insertPayload)
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, play_type, canvas_data, created_at, updated_at")
      .single()

    if (playError) {
      console.error(`${LOG_PREFIX} insert failed:`, playError.code, playError.message, playError.details)
      const message = playError.message?.trim() || "Failed to create play"
      return NextResponse.json(
        { error: message, details: playError.details },
        { status: 500 }
      )
    }
    if (!play) {
      console.error(`${LOG_PREFIX} insert returned no row`)
      return NextResponse.json({ error: "Failed to create play" }, { status: 500 })
    }

    console.log(`${LOG_PREFIX} insert result id: ${play.id}`)

    const res = NextResponse.json({
      id: play.id,
      teamId: play.team_id,
      playbookId: play.playbook_id ?? null,
      formationId: (play as { formation_id?: string }).formation_id ?? null,
      subFormationId: (play as { sub_formation_id?: string }).sub_formation_id ?? null,
      side: play.side,
      formation: play.formation,
      subFormation: subFormationNameForInsert,
      subcategory: play.subcategory ?? null,
      name: play.name,
      playType: (play as { play_type?: string | null }).play_type ?? null,
      canvasData: play.canvas_data,
      createdAt: play.created_at,
      updatedAt: play.updated_at,
    })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as Error & { message?: string }
    console.error(`${LOG_PREFIX} unexpected error:`, err?.message ?? error)
    const message = err?.message ?? "Failed to create play"
    const status = message.includes("Access denied") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
