import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

const ROUTE = "api/plays"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Phase =
  | "request_start"
  | "parse_query"
  | "parse_body"
  | "auth"
  | "team_permission"
  | "database"
  | "response_success"
  | "response_error"

type LogMeta = {
  debugId: string
  phase: Phase
  method?: string
  teamId?: string | null
  userId?: string | null
  playId?: string | null
  playbookId?: string | null
  formationId?: string | null
  subFormationId?: string | null
  creationLevel?: "playbook" | "formation" | "sub_formation"
  hasCanvasData?: boolean
  stack?: string
  helper?: string
  message?: string
  code?: string
  details?: string
  hint?: string
}

function logPhase(meta: LogMeta) {
  const safe = { ...meta }
  console.log(`[${ROUTE}]`, JSON.stringify(safe))
}

function errorResponse(
  debugId: string,
  phase: Phase,
  message: string,
  status: number,
  safeDetails?: Record<string, unknown>
) {
  const body: Record<string, unknown> = {
    error: message,
    debugId,
    phase,
    ...(process.env.NODE_ENV !== "production" && safeDetails ? { details: safeDetails } : {}),
  }
  return NextResponse.json(body, { status })
}

interface SupabaseLikeError {
  message?: string
  details?: string
  hint?: string
  code?: string
}

function supabaseErrorSafe(err: unknown): SupabaseLikeError {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as SupabaseLikeError
    return {
      message: typeof e.message === "string" ? e.message : undefined,
      details: typeof e.details === "string" ? e.details : undefined,
      hint: typeof e.hint === "string" ? e.hint : undefined,
      code: typeof e.code === "string" ? e.code : undefined,
    }
  }
  return {}
}

function safeString(val: unknown): string | undefined {
  if (val == null) return undefined
  if (typeof val === "string") return val.trim()
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

/** DB columns play_type, order_index, tags may be missing until migrations applied. */
type PlayRow = {
  id: string
  team_id: string
  playbook_id?: string | null
  formation_id?: string | null
  sub_formation_id?: string | null
  side: string
  formation: string
  subcategory?: string | null
  name: string
  play_type?: string | null
  canvas_data?: unknown
  order_index?: number | null
  tags?: string[] | null
  created_at?: string
  updated_at?: string
}

const VALID_PLAY_TYPES_SET = new Set<string>(["run", "pass", "rpo", "screen"])

function getPlayTypeFromRow(row: PlayRow): "run" | "pass" | "rpo" | "screen" | null {
  const raw = (row as Record<string, unknown>).play_type
  if (typeof raw !== "string" || !VALID_PLAY_TYPES_SET.has(raw)) return null
  return raw as "run" | "pass" | "rpo" | "screen"
}

function formatPlayForResponse(
  p: PlayRow,
  subFormationNameMap: Map<string, string>
): Record<string, unknown> {
  const canvasData = p.canvas_data
  const safeCanvas =
    canvasData != null && typeof canvasData === "object" && !Array.isArray(canvasData)
      ? (canvasData as Record<string, unknown>)
      : null
  const sfId = p.sub_formation_id ?? null
  const playType = getPlayTypeFromRow(p)
  return {
    id: p.id,
    teamId: p.team_id,
    playbookId: p.playbook_id ?? null,
    formationId: p.formation_id ?? null,
    subFormationId: sfId,
    side: p.side,
    formation: p.formation,
    subFormation: sfId ? subFormationNameMap.get(sfId) ?? null : null,
    subcategory: p.subcategory ?? null,
    name: p.name,
    playType,
    canvasData: safeCanvas,
    orderIndex: (p as PlayRow).order_index ?? null,
    tags: Array.isArray((p as PlayRow).tags) ? (p as PlayRow).tags : null,
    createdAt: p.created_at ?? null,
    updatedAt: p.updated_at ?? null,
  }
}

const VALID_SIDES = ["offense", "defense", "special_teams"] as const
const VALID_PLAY_TYPES = ["run", "pass", "rpo", "screen"] as const

/**
 * GET /api/plays?teamId=xxx&side=xxx
 * Returns plays for the team, optionally filtered by side.
 */
export async function GET(request: Request) {
  const debugId = crypto.randomUUID()
  try {
    logPhase({ debugId, phase: "request_start", method: "GET" })

    let session: Awaited<ReturnType<typeof getServerSession>>
    try {
      session = await getServerSession()
    } catch (authErr) {
      logPhase({
        debugId,
        phase: "auth",
        method: "GET",
        helper: "getServerSession",
        message: authErr instanceof Error ? authErr.message : String(authErr),
      })
      return errorResponse(
        debugId,
        "auth",
        "Session lookup failed",
        500,
        process.env.NODE_ENV !== "production" ? { cause: String(authErr) } : undefined
      )
    }

    if (!session?.user?.id) {
      logPhase({ debugId, phase: "auth", method: "GET", userId: null })
      return errorResponse(debugId, "auth", "Unauthorized", 401)
    }

    logPhase({ debugId, phase: "auth", method: "GET", userId: session.user.id })

    let teamId: string | null
    let side: string | null
    let playbookId: string | null = null
    let formationId: string | null = null
    let subFormationId: string | null = null
    try {
      const url = request.url ? new URL(request.url) : null
      const searchParams = url?.searchParams ?? new URLSearchParams()
      teamId = searchParams.get("teamId")?.trim() ?? null
      side = searchParams.get("side")?.trim() ?? null
      playbookId = searchParams.get("playbookId")?.trim() ?? null
      formationId = searchParams.get("formationId")?.trim() ?? null
      subFormationId = searchParams.get("subFormationId")?.trim() ?? null
    } catch (parseErr) {
      logPhase({
        debugId,
        phase: "parse_query",
        method: "GET",
        message: parseErr instanceof Error ? parseErr.message : String(parseErr),
      })
      return errorResponse(debugId, "parse_query", "Invalid request URL", 400)
    }

    logPhase({
      debugId,
      phase: "parse_query",
      method: "GET",
      teamId,
      playbookId,
      formationId,
      subFormationId,
      userId: session.user.id,
    })

    if (!teamId) {
      return errorResponse(debugId, "parse_query", "teamId is required", 400)
    }
    if (!isValidUuid(teamId)) {
      return errorResponse(debugId, "parse_query", "teamId must be a valid UUID", 422)
    }

    const supabase = getSupabaseServer()

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .maybeSingle()

    if (teamError) {
      const se = supabaseErrorSafe(teamError)
      logPhase({
        debugId,
        phase: "database",
        method: "GET",
        teamId,
        userId: session.user.id,
        message: se.message,
        code: se.code,
        details: se.details,
        hint: se.hint,
      })
      return errorResponse(debugId, "database", "Failed to load team", 500, { ...se })
    }

    if (!team) {
      logPhase({ debugId, phase: "database", method: "GET", teamId, userId: session.user.id })
      return errorResponse(debugId, "database", "Team not found", 404)
    }

    try {
      await requireTeamAccess(teamId)
    } catch (accessErr) {
      if (accessErr instanceof MembershipLookupError) {
        logPhase({
          debugId,
          phase: "team_permission",
          method: "GET",
          teamId,
          userId: session.user.id,
          helper: "requireTeamAccess",
          message: accessErr.message,
        })
        return errorResponse(
          debugId,
          "team_permission",
          "Membership lookup failed",
          500,
          process.env.NODE_ENV !== "production" ? { cause: accessErr.message } : undefined
        )
      }
      const msg = accessErr instanceof Error ? accessErr.message : "Access denied"
      logPhase({
        debugId,
        phase: "team_permission",
        method: "GET",
        teamId,
        userId: session.user.id,
        helper: "requireTeamAccess",
        message: msg,
      })
      return errorResponse(debugId, "team_permission", msg, 403)
    }

    logPhase({ debugId, phase: "team_permission", method: "GET", teamId, userId: session.user.id })

    // Use a select that avoids optional columns (play_type, order_index, tags) so listing works
    // even if those migrations haven't been applied. Order by name only to avoid order_index dependency.
    const playsSelect =
      "id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, canvas_data, created_at, updated_at"
    let query = supabase.from("plays").select(playsSelect).eq("team_id", teamId)

    if (side ?? false) {
      query = query.eq("side", side!)
    }
    if (playbookId && isValidUuid(playbookId)) {
      query = query.eq("playbook_id", playbookId)
    }
    if (formationId && isValidUuid(formationId)) {
      query = query.eq("formation_id", formationId)
    }
    if (subFormationId && isValidUuid(subFormationId)) {
      query = query.eq("sub_formation_id", subFormationId)
    }

    const { data: plays, error: playsError } = await query.order("name", { ascending: true })

    if (playsError) {
      const se = supabaseErrorSafe(playsError)
      logPhase({
        debugId,
        phase: "database",
        method: "GET",
        teamId,
        userId: session.user.id,
        message: se.message,
        code: se.code,
        details: se.details,
        hint: se.hint,
      })
      return errorResponse(debugId, "database", "Failed to load plays", 500, { ...se })
    }

    const playsList = Array.isArray(plays) ? plays : []
    const subFormationIds = [
      ...new Set(
        playsList
          .map((p) => (p as PlayRow).sub_formation_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const subFormationNameMap = new Map<string, string>()
    if (subFormationIds.length > 0) {
      const { data: subRows, error: subErr } = await supabase
        .from("sub_formations")
        .select("id, name")
        .in("id", subFormationIds)
      if (subErr) {
        const se = supabaseErrorSafe(subErr)
        logPhase({
          debugId,
          phase: "database",
          method: "GET",
          teamId,
          userId: session.user.id,
          message: se.message,
          code: se.code,
        })
        return errorResponse(debugId, "database", "Failed to load sub-formations", 500, { ...se })
      }
      const rows = Array.isArray(subRows) ? subRows : []
      rows.forEach((r) => subFormationNameMap.set(r.id, (r.name ?? "").trim()))
    }

    let formatted: Record<string, unknown>[]
    try {
      formatted = playsList.map((p) => formatPlayForResponse(p as PlayRow, subFormationNameMap))
    } catch (formatErr) {
      logPhase({
        debugId,
        phase: "database",
        method: "GET",
        teamId,
        userId: session.user.id,
        message: formatErr instanceof Error ? formatErr.message : String(formatErr),
      })
      return errorResponse(debugId, "database", "Failed to format plays", 500)
    }

    logPhase({
      debugId,
      phase: "response_success",
      method: "GET",
      teamId,
      userId: session.user.id,
    })

    const res = NextResponse.json(formatted)
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    logPhase({
      debugId,
      phase: "response_error",
      method: "GET",
      message: err.message,
    })
    const status = err.message.includes("Access denied") ? 403 : 500
    return errorResponse(
      debugId,
      "response_error",
      err.message ?? "Failed to load plays",
      status,
      process.env.NODE_ENV !== "production" ? { stack: err.stack } : undefined
    )
  }
}

/**
 * POST /api/plays
 * Creates a new play.
 */
export async function POST(request: Request) {
  const debugId = crypto.randomUUID()
  try {
    logPhase({ debugId, phase: "request_start", method: "POST" })

    let session: Awaited<ReturnType<typeof getServerSession>>
    try {
      session = await getServerSession()
    } catch (authErr) {
      logPhase({
        debugId,
        phase: "auth",
        method: "POST",
        helper: "getServerSession",
        message: authErr instanceof Error ? authErr.message : String(authErr),
      })
      return errorResponse(
        debugId,
        "auth",
        "Session lookup failed",
        500,
        process.env.NODE_ENV !== "production" ? { cause: String(authErr) } : undefined
      )
    }

    if (!session?.user?.id) {
      logPhase({ debugId, phase: "auth", method: "POST", userId: null })
      return errorResponse(debugId, "auth", "Unauthorized", 401)
    }

    logPhase({ debugId, phase: "auth", method: "POST", userId: session.user.id })

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      logPhase({ debugId, phase: "parse_body", method: "POST", userId: session.user.id })
      return errorResponse(debugId, "parse_body", "Invalid JSON body", 400)
    }

    const body =
      typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : {}

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

    const canvasData =
      body.canvasData === undefined ? undefined : (safeObject(body.canvasData) ?? null)

    const creationLevel = subFormationId ? "sub_formation" : formationId ? "formation" : "playbook"
    logPhase({
      debugId,
      phase: "parse_body",
      method: "POST",
      teamId: teamId ?? null,
      playbookId: playbookId ?? null,
      formationId: formationId ?? null,
      subFormationId: subFormationId ?? null,
      creationLevel,
      hasCanvasData: canvasData != null,
      userId: session.user.id,
    })

    if (!teamId) {
      return errorResponse(debugId, "parse_body", "Missing teamId", 400)
    }
    if (!isValidUuid(teamId)) {
      return errorResponse(debugId, "parse_body", "teamId must be a valid UUID", 422)
    }
    if (!side || !VALID_SIDES.includes(side as (typeof VALID_SIDES)[number])) {
      return errorResponse(
        debugId,
        "parse_body",
        "side must be offense, defense, or special_teams",
        422
      )
    }
    if (!name) {
      return errorResponse(debugId, "parse_body", "Missing play name/title", 400)
    }
    if (formationId != null && formationId !== "" && !isValidUuid(formationId)) {
      return errorResponse(debugId, "parse_body", "formationId must be a valid UUID", 422)
    }
    if (subFormationId != null && subFormationId !== "" && !isValidUuid(subFormationId)) {
      return errorResponse(debugId, "parse_body", "subFormationId must be a valid UUID", 422)
    }
    if (playbookId != null && playbookId !== "" && !isValidUuid(playbookId)) {
      return errorResponse(debugId, "parse_body", "playbookId must be a valid UUID", 422)
    }

    if (subFormationId && (!formationId || formationId === "")) {
      return errorResponse(
        debugId,
        "parse_body",
        "formationId is required when subFormationId is provided",
        400
      )
    }

    try {
      if (side === "offense") {
        await requireTeamPermission(teamId, "edit_offense_plays")
      } else if (side === "defense") {
        await requireTeamPermission(teamId, "edit_defense_plays")
      } else {
        await requireTeamPermission(teamId, "edit_special_teams_plays")
      }
    } catch (permErr) {
      if (permErr instanceof MembershipLookupError) {
        logPhase({
          debugId,
          phase: "team_permission",
          method: "POST",
          teamId,
          userId: session.user.id,
          helper: "requireTeamPermission",
          message: permErr.message,
        })
        return errorResponse(
          debugId,
          "team_permission",
          "Membership lookup failed",
          500,
          process.env.NODE_ENV !== "production" ? { cause: permErr.message } : undefined
        )
      }
      const msg = permErr instanceof Error ? permErr.message : "Access denied"
      logPhase({
        debugId,
        phase: "team_permission",
        method: "POST",
        teamId,
        userId: session.user.id,
        helper: "requireTeamPermission",
        message: msg,
      })
      return errorResponse(debugId, "team_permission", msg, 403)
    }

    logPhase({
      debugId,
      phase: "team_permission",
      method: "POST",
      teamId,
      userId: session.user.id,
    })

    const supabase = getSupabaseServer()

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .maybeSingle()

    if (teamError) {
      const se = supabaseErrorSafe(teamError)
      logPhase({
        debugId,
        phase: "database",
        method: "POST",
        teamId,
        userId: session.user.id,
        message: se.message,
        code: se.code,
        details: se.details,
        hint: se.hint,
      })
      return errorResponse(debugId, "database", "Failed to load team", 500, { ...se })
    }

    if (!team) {
      return errorResponse(debugId, "database", "Team not found", 404)
    }

    if (playbookId) {
      const { data: playbook, error: playbookError } = await supabase
        .from("playbooks")
        .select("id")
        .eq("id", playbookId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (playbookError) {
        const se = supabaseErrorSafe(playbookError)
        logPhase({
          debugId,
          phase: "database",
          method: "POST",
          teamId,
          userId: session.user.id,
          message: se.message,
          code: se.code,
        })
        return errorResponse(debugId, "database", "Failed to load playbook", 500, { ...se })
      }
      if (!playbook) {
        return errorResponse(debugId, "database", "Playbook not found", 404)
      }
    }

    let formationNameForInsert = formation ?? ""
    if (formationId) {
      const { data: formationRow, error: formationError } = await supabase
        .from("formations")
        .select("id, name")
        .eq("id", formationId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (formationError) {
        const se = supabaseErrorSafe(formationError)
        logPhase({
          debugId,
          phase: "database",
          method: "POST",
          teamId,
          userId: session.user.id,
          message: se.message,
          code: se.code,
        })
        return errorResponse(debugId, "database", "Failed to load formation", 500, { ...se })
      }
      if (!formationRow) {
        return errorResponse(debugId, "database", "Formation not found", 404)
      }
      formationNameForInsert = (formationRow.name ?? "").trim() || formationNameForInsert
    }
    if (!formationNameForInsert) {
      formationNameForInsert = (formation && formation.trim()) || "Custom"
    }
    if (!formationNameForInsert) {
      return errorResponse(
        debugId,
        "parse_body",
        "formation is required (provide formation name or formationId)",
        400
      )
    }

    let subFormationNameForInsert: string | null = null
    if (subFormationId) {
      const { data: subRow, error: subError } = await supabase
        .from("sub_formations")
        .select("id, name, formation_id")
        .eq("id", subFormationId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (subError) {
        const se = supabaseErrorSafe(subError)
        logPhase({
          debugId,
          phase: "database",
          method: "POST",
          teamId,
          userId: session.user.id,
          message: se.message,
          code: se.code,
        })
        return errorResponse(debugId, "database", "Failed to load sub-formation", 500, { ...se })
      }
      if (!subRow) {
        return errorResponse(debugId, "database", "Sub-formation not found", 404)
      }
      const subFormationIdDb = (subRow as { formation_id?: string }).formation_id
      if (formationId && subFormationIdDb !== formationId) {
        return errorResponse(
          debugId,
          "parse_body",
          "Sub-formation does not belong to the given formation",
          400
        )
      }
      subFormationNameForInsert = (subRow.name ?? "").trim() || null
    }

    let safeCanvasData: unknown = null
    if (canvasData != null && typeof canvasData === "object") {
      try {
        safeCanvasData = JSON.parse(JSON.stringify(canvasData))
      } catch (e) {
        logPhase({
          debugId,
          phase: "parse_body",
          method: "POST",
          message: "canvasData not JSON-serializable",
          userId: session.user.id,
        })
        return errorResponse(debugId, "parse_body", "Invalid canvas data", 400)
      }
    }

    const insertPayload: Record<string, unknown> = {
      team_id: teamId,
      playbook_id: playbookId && playbookId.trim() !== "" ? playbookId : null,
      side,
      formation: formationNameForInsert,
      subcategory: subcategory ?? null,
      name: name.trim(),
      canvas_data: safeCanvasData,
    }
    if (formationId != null && formationId.trim() !== "") {
      insertPayload.formation_id = formationId
    }
    if (subFormationId != null && subFormationId.trim() !== "") {
      insertPayload.sub_formation_id = subFormationId
    }
    // Omit tags from insert so play creation works when tags column is not yet migrated
    // const tagsRaw = body.tags
    // if (Array.isArray(tagsRaw)) { ... insertPayload.tags = tagsFiltered }

    logPhase({
      debugId,
      phase: "database",
      method: "POST",
      teamId,
      playbookId: playbookId ?? null,
      formationId: formationId ?? null,
      subFormationId: subFormationId ?? null,
      hasCanvasData: safeCanvasData != null,
      userId: session.user.id,
    })

    const playSelect =
      "id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, canvas_data, created_at, updated_at"
    const { data: play, error: playError } = await supabase
      .from("plays")
      .insert(insertPayload)
      .select(playSelect)
      .single()

    if (playError) {
      const se = supabaseErrorSafe(playError)
      logPhase({
        debugId,
        phase: "database",
        method: "POST",
        teamId,
        userId: session.user.id,
        message: se.message,
        code: se.code,
        details: se.details,
        hint: se.hint,
      })
      const safeMessage = (se.message ?? "Failed to create play").trim() || "Failed to create play"
      return errorResponse(debugId, "database", safeMessage, 500, { ...se })
    }

    if (!play) {
      logPhase({
        debugId,
        phase: "database",
        method: "POST",
        teamId,
        userId: session.user.id,
        message: "Insert returned no row",
      })
      return errorResponse(debugId, "database", "Failed to create play", 500)
    }

    logPhase({
      debugId,
      phase: "response_success",
      method: "POST",
      teamId,
      userId: session.user.id,
      playId: (play as { id?: string }).id,
    })

    const res = NextResponse.json({
      id: (play as PlayRow).id,
      teamId: (play as PlayRow).team_id,
      playbookId: (play as PlayRow).playbook_id ?? null,
      formationId: (play as PlayRow).formation_id ?? null,
      subFormationId: (play as PlayRow).sub_formation_id ?? null,
      side: (play as PlayRow).side,
      formation: (play as PlayRow).formation,
      subFormation: subFormationNameForInsert,
      subcategory: (play as PlayRow).subcategory ?? null,
      name: (play as PlayRow).name,
      playType: getPlayTypeFromRow(play as PlayRow),
      canvasData: (play as PlayRow).canvas_data ?? null,
      orderIndex: (play as PlayRow).order_index ?? null,
      tags: Array.isArray((play as PlayRow).tags) ? (play as PlayRow).tags : null,
      createdAt: (play as PlayRow).created_at ?? null,
      updatedAt: (play as PlayRow).updated_at ?? null,
    })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error(`[${ROUTE}] POST unhandled error`, err.message, err.stack)
    logPhase({
      debugId,
      phase: "response_error",
      method: "POST",
      message: err.message,
      stack: err.stack,
    })
    const status = err.message.includes("Access denied") ? 403 : 500
    return errorResponse(
      debugId,
      "response_error",
      err.message ?? "Failed to create play",
      status,
      process.env.NODE_ENV !== "production" ? { stack: err.stack } : undefined
    )
  }
}
