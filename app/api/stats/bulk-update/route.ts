/**
 * PATCH /api/stats/bulk-update — apply shared game-level fields to many weekly stat rows.
 * Requires edit_roster. Scoped by team_id. Only non-deleted rows are updated.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import {
  insertWeeklyStatEntryAudit,
  weeklyEntryRowToAuditSnapshot,
} from "@/lib/stats-weekly-audit"
import {
  normalizeWeeklyGameTypeInput,
  normalizeWeeklyResultInput,
} from "@/lib/stats-weekly-game-meta"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const WEEKLY_STAT_ENTRY_AUDIT_COLUMNS = [
  "id",
  "team_id",
  "player_id",
  "season_year",
  "week_number",
  "game_id",
  "opponent",
  "game_date",
  "game_type",
  "location",
  "venue",
  "result",
  "team_score",
  "opponent_score",
  "notes",
  "stats",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "deleted_at",
  "deleted_by",
].join(",")

type WeeklyStatAuditRow = {
  id: string
  team_id: string
  player_id: string
  season_year: number | null
  week_number: number | null
  game_id: string | null
  opponent: string | null
  game_date: string | null
  game_type: string | null
  location: string | null
  venue: string | null
  result: string | null
  team_score: number | null
  opponent_score: number | null
  notes: string | null
  stats: Record<string, unknown> | null
  created_at: string | null
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

type UpdatesBody = {
  opponent?: unknown
  date?: unknown
  week?: unknown
  game_type?: unknown
  location?: unknown
  venue?: unknown
  result?: unknown
  team_score?: unknown
  opponent_score?: unknown
  notes?: unknown
}

type RequestBody = {
  teamId?: string
  ids?: unknown
  updates?: UpdatesBody
}

function parseScore(v: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === null) return { ok: true, value: null }
  if (typeof v === "number" && Number.isFinite(v)) {
    if (!Number.isInteger(v) || v < 0) return { ok: false, error: "Scores must be non-negative integers" }
    return { ok: true, value: v }
  }
  return { ok: false, error: "Invalid score value" }
}

function buildDbPatch(updates: UpdatesBody | null | undefined):
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; error: string } {
  if (!updates || typeof updates !== "object") {
    return { ok: false, error: "updates object is required" }
  }
  const patch: Record<string, unknown> = {}

  if ("opponent" in updates) {
    if (updates.opponent === null) patch.opponent = null
    else if (typeof updates.opponent === "string") {
      const t = updates.opponent.trim()
      if (t) patch.opponent = t
    } else return { ok: false, error: "Invalid opponent" }
  }

  if ("date" in updates) {
    if (updates.date === null) patch.game_date = null
    else if (typeof updates.date === "string") {
      const t = updates.date.trim()
      if (!t) {
        /* skip empty */
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        return { ok: false, error: "date must be YYYY-MM-DD" }
      } else {
        patch.game_date = t
      }
    } else return { ok: false, error: "Invalid date" }
  }

  if ("week" in updates) {
    if (updates.week === null) patch.week_number = null
    else if (typeof updates.week === "number" && Number.isFinite(updates.week)) {
      const w = Math.trunc(updates.week)
      if (w < 1 || w > 53) return { ok: false, error: "week must be between 1 and 53" }
      patch.week_number = w
    } else return { ok: false, error: "Invalid week" }
  }

  if ("game_type" in updates) {
    if (updates.game_type === null) patch.game_type = null
    else if (typeof updates.game_type === "string") {
      const t = updates.game_type.trim()
      if (!t) {
        /* skip */
      } else {
        const g = normalizeWeeklyGameTypeInput(t)
        if (!g) return { ok: false, error: "Invalid game_type" }
        patch.game_type = g
      }
    } else return { ok: false, error: "Invalid game_type" }
  }

  if ("location" in updates) {
    if (updates.location === null) patch.location = null
    else if (typeof updates.location === "string") {
      const t = updates.location.trim()
      if (t) patch.location = t
    } else return { ok: false, error: "Invalid location" }
  }

  if ("venue" in updates) {
    if (updates.venue === null) patch.venue = null
    else if (typeof updates.venue === "string") {
      const t = updates.venue.trim()
      if (t) patch.venue = t
    } else return { ok: false, error: "Invalid venue" }
  }

  if ("result" in updates) {
    if (updates.result === null) patch.result = null
    else if (typeof updates.result === "string") {
      const t = updates.result.trim()
      if (!t) {
        /* skip */
      } else {
        const r = normalizeWeeklyResultInput(t)
        if (!r) return { ok: false, error: "Invalid result" }
        patch.result = r
      }
    } else return { ok: false, error: "Invalid result" }
  }

  if ("team_score" in updates) {
    const p = parseScore(updates.team_score)
    if (!p.ok) return p
    patch.team_score = p.value
  }

  if ("opponent_score" in updates) {
    const p = parseScore(updates.opponent_score)
    if (!p.ok) return p
    patch.opponent_score = p.value
  }

  if (("team_score" in updates) !== ("opponent_score" in updates)) {
    return {
      ok: false,
      error: "team_score and opponent_score must be provided together (or omit both).",
    }
  }

  if ("notes" in updates) {
    if (updates.notes === null) patch.notes = null
    else if (typeof updates.notes === "string") {
      const t = updates.notes.trim()
      if (t) patch.notes = t
    } else return { ok: false, error: "Invalid notes" }
  }

  const metaKeys = [
    "opponent",
    "game_date",
    "week_number",
    "game_type",
    "location",
    "venue",
    "result",
    "team_score",
    "opponent_score",
    "notes",
  ]
  const hasAny = metaKeys.some((k) => k in patch)
  if (!hasAny) {
    return { ok: false, error: "No fields to update" }
  }

  return { ok: true, patch }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = (await request.json().catch(() => null)) as RequestBody | null
    const teamId = body?.teamId?.trim()
    const rawIds = body?.ids
    const ids = Array.isArray(rawIds)
      ? rawIds.filter((x): x is string => typeof x === "string" && UUID_REGEX.test(x))
      : []

    if (!teamId || ids.length === 0) {
      return NextResponse.json({ error: "teamId and ids are required" }, { status: 400 })
    }
    if (ids.length > 500) {
      return NextResponse.json({ error: "Too many ids" }, { status: 400 })
    }

    const built = buildDbPatch(body?.updates ?? undefined)
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 400 })
    }
    const { patch: fieldPatch } = built

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const { data: beforeRows, error: fetchErr } = await supabase
      .from("player_weekly_stat_entries")
      .select(WEEKLY_STAT_ENTRY_AUDIT_COLUMNS)
      .eq("team_id", teamId)
      .in("id", ids)
      .is("deleted_at", null)

    if (fetchErr) {
      console.error("[PATCH /api/stats/bulk-update] fetch", fetchErr)
      return NextResponse.json({ error: "Failed to load entries" }, { status: 500 })
    }

    const beforeList = ((beforeRows ?? []) as unknown) as WeeklyStatAuditRow[]
    if (beforeList.length === 0) {
      return NextResponse.json({ success: true, updated: 0 })
    }

    const now = new Date().toISOString()
    const updatePayload = {
      ...fieldPatch,
      updated_at: now,
      updated_by: userId,
    }

    const targetIds = beforeList.map((r) => r.id)

    const { data: afterRows, error: upErr } = await supabase
      .from("player_weekly_stat_entries")
      .update(updatePayload)
      .eq("team_id", teamId)
      .in("id", targetIds)
      .is("deleted_at", null)
      .select(WEEKLY_STAT_ENTRY_AUDIT_COLUMNS)

    if (upErr) {
      console.error("[PATCH /api/stats/bulk-update] update", upErr)
      return NextResponse.json({ error: "Failed to update entries" }, { status: 500 })
    }

    const afterList = ((afterRows ?? []) as unknown) as WeeklyStatAuditRow[]
    const afterById = new Map(afterList.map((r) => [r.id, r]))
    for (const row of beforeList) {
      const id = row.id
      const after = afterById.get(id)
      if (!after) continue
      await insertWeeklyStatEntryAudit(supabase, {
        entryId: id,
        teamId,
        action: "update",
        beforeData: weeklyEntryRowToAuditSnapshot(row),
        afterData: weeklyEntryRowToAuditSnapshot(after),
        actedBy: userId,
      })
    }

    return NextResponse.json({ success: true, updated: afterList.length })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[PATCH /api/stats/bulk-update]", err)
    return NextResponse.json({ error: "Failed to bulk-update stats" }, { status: 500 })
  }
}
