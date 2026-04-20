import type { SupabaseClient } from "@supabase/supabase-js"
import type { MatchType, UnifiedSearchResultRow } from "@/lib/admin/dev-console-types"

const UUID_FULL =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

const PARTIAL_ONLY = /^[0-9a-fA-F-]+$/

export type ParsedGlobalQuery =
  | { kind: "empty" }
  | { kind: "uuid_full"; uuid: string }
  | { kind: "uuid_partial"; fragment: string }
  | { kind: "time_range"; startIso: string; endIso: string }
  | {
      kind: "relative_range"
      preset: "today" | "last_24h" | "last_7d" | "last_30d"
      startIso: string
      endIso: string
    }
  | { kind: "text_search"; text: string }

export type EntityTableFilter = "users" | "teams" | "subscriptions" | "audit_logs" | "agent_actions" | "creations"

export function stripHyphens(s: string): string {
  return s.replace(/-/g, "")
}

/** Minimum hex chars (excluding hyphens) for partial UUID detection. */
export function partialUuidLooksLike(fragment: string): boolean {
  const hex = stripHyphens(fragment.trim())
  return hex.length >= 8 && /^[0-9a-fA-F]+$/.test(hex)
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

export function relativePresetRange(
  preset: "today" | "last_24h" | "last_7d" | "last_30d",
  nowMs: number = Date.now()
): { startIso: string; endIso: string } {
  const now = new Date(nowMs)
  if (preset === "today") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const end = new Date(start.getTime() + 86400000 - 1)
    return { startIso: start.toISOString(), endIso: end.toISOString() }
  }
  const dur =
    preset === "last_24h"
      ? 86400000
      : preset === "last_7d"
        ? 7 * 86400000
        : 30 * 86400000
  return { startIso: new Date(nowMs - dur).toISOString(), endIso: new Date(nowMs).toISOString() }
}

function parseRelativePreset(qRaw: string): ParsedGlobalQuery | null {
  const key = qRaw.trim().toLowerCase().replace(/\s+/g, " ")
  const presets: Record<string, "today" | "last_24h" | "last_7d" | "last_30d"> = {
    today: "today",
    "last 24 hours": "last_24h",
    "last 24h": "last_24h",
    "last 7 days": "last_7d",
    "last 7d": "last_7d",
    "last 30 days": "last_30d",
    "last 30d": "last_30d",
  }
  const preset = presets[key]
  if (!preset) return null
  const { startIso, endIso } = relativePresetRange(preset)
  return { kind: "relative_range", preset, startIso, endIso }
}

export function parseGlobalQuery(qRaw: string): ParsedGlobalQuery {
  const q = qRaw.trim()
  if (!q) return { kind: "empty" }

  const relative = parseRelativePreset(qRaw)
  if (relative) return relative

  const rangeFromSep = splitRange(q)
  if (rangeFromSep) {
    return { kind: "time_range", startIso: rangeFromSep.start.toISOString(), endIso: rangeFromSep.end.toISOString() }
  }

  if (UUID_FULL.test(q)) {
    return { kind: "uuid_full", uuid: q.toLowerCase() }
  }

  const single = parseInstantOrDayRange(q)
  if (single) {
    return { kind: "time_range", startIso: single.start.toISOString(), endIso: single.end.toISOString() }
  }

  if (PARTIAL_ONLY.test(q) && partialUuidLooksLike(q)) {
    return { kind: "uuid_partial", fragment: q.trim().toLowerCase() }
  }

  return { kind: "text_search", text: q.trim() }
}

function splitRange(q: string): { start: Date; end: Date } | null {
  const seps = ["..", " — ", " – ", " - ", " to "] as const
  for (const sep of seps) {
    const idx = q.indexOf(sep)
    if (idx < 0) continue
    const a = q.slice(0, idx).trim()
    const b = q.slice(idx + sep.length).trim()
    const start = parseRangeEndpoint(a, "start")
    const end = parseRangeEndpoint(b, "end")
    if (!start || !end) continue
    if (end.getTime() < start.getTime()) {
      return { start: end, end: start }
    }
    return { start, end }
  }
  return null
}

function parseRangeEndpoint(s: string, kind: "start" | "end"): Date | null {
  const t = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    if (kind === "start") return new Date(`${t}T00:00:00.000Z`)
    return new Date(`${t}T23:59:59.999Z`)
  }
  return parseLooseDate(t)
}

function parseLooseDate(s: string): Date | null {
  const t = s.trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const start = new Date(`${t}T00:00:00.000Z`)
    if (Number.isNaN(start.getTime())) return null
    return start
  }
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Single calendar day (UTC) or a narrow window around an instant. */
function parseInstantOrDayRange(q: string): { start: Date; end: Date } | null {
  const t = q.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const start = new Date(`${t}T00:00:00.000Z`)
    if (Number.isNaN(start.getTime())) return null
    const end = new Date(`${t}T23:59:59.999Z`)
    return { start, end }
  }
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  const windowMs = 15 * 60 * 1000
  return { start: new Date(d.getTime() - windowMs), end: new Date(d.getTime() + windowMs) }
}

export function parseTableFilters(raw: string | null): Set<EntityTableFilter> | null {
  if (!raw || !raw.trim()) return null
  const allowed = new Set<EntityTableFilter>([
    "users",
    "teams",
    "subscriptions",
    "audit_logs",
    "agent_actions",
    "creations",
  ])
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const out = new Set<EntityTableFilter>()
  for (const p of parts) {
    if (allowed.has(p as EntityTableFilter)) out.add(p as EntityTableFilter)
  }
  return out.size ? out : null
}

export function normalizeLimit(n: number | undefined, fallback: number, max: number): number {
  if (n == null || Number.isNaN(n)) return fallback
  return Math.min(Math.max(1, Math.floor(n)), max)
}

export function normalizeOffset(n: number | undefined): number {
  if (n == null || Number.isNaN(n)) return 0
  return Math.max(0, Math.floor(n))
}

const AUDIT_LOG_COLUMNS =
  "id, actor_id, action_type, action, target_type, target_id, metadata_json, metadata, created_at, team_id"

export function isFullUuid(text: string): boolean {
  return UUID_FULL.test(text.trim())
}

/** Quick search typed as email — not a UUID, contains @ */
export function looksLikeEmailQuery(q: string): boolean {
  const t = q.trim()
  if (!t.includes("@")) return false
  if (UUID_FULL.test(t)) return false
  return true
}

export async function fetchUsersByEmailSearch(params: {
  supabase: SupabaseClient
  pattern: string
  offset: number
  limit: number
}) {
  const { supabase, pattern, offset, limit } = params
  const p = pattern.trim()
  if (!p) return { hits: [] as { source_table: string; matched_column: string; record_id: string; label: string; created_at: string | null; summary: Record<string, unknown> }[], total: 0 }

  let q = supabase
    .from("users")
    .select("id, email, name, role, status, created_at", { count: "exact" })
    .ilike("email", `%${p}%`)
    .order("created_at", { ascending: false })

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  const hits = (rows ?? []).map((u) => {
    const row = u as Record<string, unknown>
    const id = String(row.id ?? "")
    return {
      source_table: "users",
      matched_column: "email",
      record_id: id,
      label: String(row.email ?? id),
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      summary: row as Record<string, unknown>,
    }
  })

  return { hits, total: count ?? hits.length }
}

export function pickAuditRow(raw: Record<string, unknown>) {
  const actionType =
    (typeof raw.action_type === "string" && raw.action_type) ||
    (typeof raw.action === "string" && raw.action) ||
    ""
  let meta: unknown = raw.metadata_json ?? raw.metadata ?? null
  if (meta && typeof meta === "string") {
    try {
      meta = JSON.parse(meta)
    } catch {
      /* keep string */
    }
  }
  return {
    id: raw.id as string,
    action_type: actionType,
    actor_id: raw.actor_id as string,
    target_type: (raw.target_type as string | null) ?? null,
    target_id: (raw.target_id as string | null) ?? null,
    metadata_json: meta,
    created_at: raw.created_at as string,
    team_id: (raw.team_id as string | null) ?? null,
  }
}

export async function fetchAuditLogsRange(params: {
  supabase: SupabaseClient
  startIso?: string | null
  endIso?: string | null
  actionType?: string | null
  actorId?: string | null
  targetIdLike?: string | null
  offset: number
  limit: number
}) {
  const { supabase, startIso, endIso, actionType, actorId, targetIdLike, offset, limit } = params

  let q = supabase
    .from("audit_logs")
    .select(AUDIT_LOG_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
  if (startIso) q = q.gte("created_at", startIso)
  if (endIso) q = q.lte("created_at", endIso)
  if (actionType?.trim()) q = q.eq("action_type", actionType.trim())
  if (actorId?.trim()) q = q.eq("actor_id", actorId.trim())
  if (targetIdLike?.trim()) q = q.ilike("target_id", `%${targetIdLike.trim()}%`)

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  return {
    rows: (rows ?? []).map((r) => pickAuditRow(r as Record<string, unknown>)),
    total: count ?? rows?.length ?? 0,
  }
}

/** Uses actor_id + created_at index when actorId set; action_type + created_at when actionType set. */
export async function fetchAuditLogsForUuid(params: {
  supabase: SupabaseClient
  uuid: string
  offset: number
  limit: number
}) {
  const { supabase, uuid, offset, limit } = params
  return fetchAuditLogsForUuidFiltered({
    supabase,
    uuid,
    startIso: undefined,
    endIso: undefined,
    actionType: undefined,
    offset,
    limit,
  })
}

export async function fetchAuditLogsForUuidFiltered(params: {
  supabase: SupabaseClient
  uuid: string
  startIso?: string | null
  endIso?: string | null
  actionType?: string | null
  offset: number
  limit: number
}) {
  const { supabase, uuid, startIso, endIso, actionType, offset, limit } = params
  const id = uuid.toLowerCase()

  let q = supabase
    .from("audit_logs")
    .select(AUDIT_LOG_COLUMNS, { count: "exact" })
    .or(`actor_id.eq.${id},target_id.eq.${id}`)
    .order("created_at", { ascending: false })

  if (startIso) q = q.gte("created_at", startIso)
  if (endIso) q = q.lte("created_at", endIso)
  if (actionType?.trim()) q = q.eq("action_type", actionType.trim())

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  return {
    rows: (rows ?? []).map((r) => pickAuditRow(r as Record<string, unknown>)),
    total: count ?? rows?.length ?? 0,
  }
}

export async function fetchAuditLogsTargetPartial(params: {
  supabase: SupabaseClient
  fragment: string
  offset: number
  limit: number
}) {
  const { supabase, fragment, offset, limit } = params
  let q = supabase
    .from("audit_logs")
    .select(AUDIT_LOG_COLUMNS, { count: "exact" })
    .ilike("target_id", `%${fragment}%`)
    .order("created_at", { ascending: false })
  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error
  return {
    rows: (rows ?? []).map((r) => pickAuditRow(r as Record<string, unknown>)),
    total: count ?? rows?.length ?? 0,
  }
}

export async function fetchAgentActionsRange(params: {
  supabase: SupabaseClient
  startIso?: string | null
  endIso?: string | null
  userId?: string | null
  teamId?: string | null
  offset: number
  limit: number
}) {
  const { supabase, startIso, endIso, userId, teamId, offset, limit } = params

  let q = supabase
    .from("agent_actions")
    .select("id, team_id, user_id, action_type, executed_at, undo_available_until, undone, cost_in_credits", {
      count: "exact",
    })
    .order("executed_at", { ascending: false })

  if (startIso) q = q.gte("executed_at", startIso)
  if (endIso) q = q.lte("executed_at", endIso)
  if (userId?.trim()) q = q.eq("user_id", userId.trim())
  if (teamId?.trim()) q = q.eq("team_id", teamId.trim())

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  return {
    rows: rows ?? [],
    total: count ?? rows?.length ?? 0,
  }
}

export async function fetchAgentActionsForUuid(params: {
  supabase: SupabaseClient
  uuid: string
  offset: number
  limit: number
}) {
  const { supabase, uuid, offset, limit } = params
  return fetchAgentActionsForUuidFiltered({
    supabase,
    uuid,
    startIso: undefined,
    endIso: undefined,
    offset,
    limit,
  })
}

export async function fetchAgentActionsForUuidFiltered(params: {
  supabase: SupabaseClient
  uuid: string
  startIso?: string | null
  endIso?: string | null
  offset: number
  limit: number
}) {
  const { supabase, uuid, startIso, endIso, offset, limit } = params
  const id = uuid.toLowerCase()

  let q = supabase
    .from("agent_actions")
    .select("id, team_id, user_id, action_type, executed_at, undo_available_until, undone, cost_in_credits", {
      count: "exact",
    })
    .or(`user_id.eq.${id},team_id.eq.${id}`)
    .order("executed_at", { ascending: false })

  if (startIso) q = q.gte("executed_at", startIso)
  if (endIso) q = q.lte("executed_at", endIso)

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  return {
    rows: rows ?? [],
    total: count ?? rows?.length ?? 0,
  }
}

export async function fetchAuditLogsWhereTargetIds(params: {
  supabase: SupabaseClient
  targetIds: string[]
  startIso?: string | null
  endIso?: string | null
  actionType?: string | null
  offset: number
  limit: number
}) {
  const { supabase, targetIds, startIso, endIso, actionType, offset, limit } = params
  const ids = [...new Set(targetIds.filter(Boolean))].slice(0, 40).map(String)
  if (!ids.length) return { rows: [], total: 0 }

  let q = supabase
    .from("audit_logs")
    .select(AUDIT_LOG_COLUMNS, { count: "exact" })
    .in("target_id", ids)
    .order("created_at", { ascending: false })

  if (startIso) q = q.gte("created_at", startIso)
  if (endIso) q = q.lte("created_at", endIso)
  if (actionType?.trim()) q = q.eq("action_type", actionType.trim())

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  return {
    rows: (rows ?? []).map((r) => pickAuditRow(r as Record<string, unknown>)),
    total: count ?? rows?.length ?? 0,
  }
}

export async function fetchAuditLogsByActorIds(params: {
  supabase: SupabaseClient
  actorIds: string[]
  startIso?: string | null
  endIso?: string | null
  actionType?: string | null
  offset: number
  limit: number
}) {
  const { supabase, actorIds, startIso, endIso, actionType, offset, limit } = params
  const ids = actorIds.filter(Boolean).slice(0, 40)
  if (ids.length === 0) return { rows: [], total: 0 }

  let q = supabase
    .from("audit_logs")
    .select(AUDIT_LOG_COLUMNS, { count: "exact" })
    .in("actor_id", ids)
    .order("created_at", { ascending: false })

  if (startIso) q = q.gte("created_at", startIso)
  if (endIso) q = q.lte("created_at", endIso)
  if (actionType?.trim()) q = q.eq("action_type", actionType.trim())

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  return {
    rows: (rows ?? []).map((r) => pickAuditRow(r as Record<string, unknown>)),
    total: count ?? rows?.length ?? 0,
  }
}

export async function fetchRecentCreations(params: {
  supabase: SupabaseClient
  startIso: string
  endIso: string
  limit: number
}) {
  const { supabase, startIso, endIso, limit } = params
  const half = Math.max(1, Math.floor(limit / 2))

  const [usersR, teamsR] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, name, role, status, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false })
      .limit(half),
    supabase
      .from("teams")
      .select("id, name, head_coach_user_id, created_at, team_status, subscription_status")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false })
      .limit(half),
  ])

  return {
    users: usersR.data ?? [],
    teams: teamsR.data ?? [],
    errors: [usersR.error?.message, teamsR.error?.message].filter(Boolean) as string[],
  }
}

function rankUserTextMatch(row: Record<string, unknown>, needleRaw: string): {
  matched_field: string
  match_type: MatchType
  relevance_score: number
} {
  const needle = needleRaw.trim().toLowerCase()
  const email = String(row.email ?? "").toLowerCase()
  const name = String(row.name ?? "").toLowerCase()
  const status = String(row.status ?? "").toLowerCase()

  if (needle.length === 0) {
    return { matched_field: "users", match_type: "unknown", relevance_score: 400 }
  }
  if (email === needle) return { matched_field: "users.email", match_type: "email_exact", relevance_score: 740 }
  if (email.includes(needle)) return { matched_field: "users.email", match_type: "email_partial", relevance_score: 720 }
  if (status === needle) return { matched_field: "users.status", match_type: "status_exact", relevance_score: 710 }
  if (status.includes(needle)) return { matched_field: "users.status", match_type: "status_partial", relevance_score: 660 }
  if (name === needle) return { matched_field: "users.name", match_type: "name_exact", relevance_score: 700 }
  if (name.includes(needle)) return { matched_field: "users.name", match_type: "name_partial", relevance_score: 640 }
  return { matched_field: "users", match_type: "text_contains", relevance_score: 520 }
}

function rankTeamTextMatch(row: Record<string, unknown>, needleRaw: string): {
  matched_field: string
  match_type: MatchType
  relevance_score: number
} {
  const needle = needleRaw.trim().toLowerCase()
  const name = String(row.name ?? "").toLowerCase()
  const ts = String(row.team_status ?? "").toLowerCase()
  const ss = String(row.subscription_status ?? "").toLowerCase()
  if (!needle) return { matched_field: "teams", match_type: "unknown", relevance_score: 400 }
  if (name.includes(needle)) return { matched_field: "teams.name", match_type: "name_partial", relevance_score: 620 }
  if (ts.includes(needle)) return { matched_field: "teams.team_status", match_type: "status_partial", relevance_score: 600 }
  if (ss.includes(needle)) return { matched_field: "teams.subscription_status", match_type: "status_partial", relevance_score: 590 }
  return { matched_field: "teams", match_type: "text_contains", relevance_score: 500 }
}

export async function fetchUsersGlobalTextSearch(params: {
  supabase: SupabaseClient
  pattern: string
  offset: number
  limit: number
  startIso?: string | null
  endIso?: string | null
}): Promise<{ hits: UnifiedSearchResultRow[]; total: number }> {
  const { supabase, pattern, offset, limit, startIso, endIso } = params
  const p = pattern.trim()
  if (!p) return { hits: [], total: 0 }

  const esc = escapeIlikePattern(p)
  const il = `%${esc}%`
  let q = supabase
    .from("users")
    .select("id, email, name, role, status, created_at", { count: "exact" })
    .or(`email.ilike.${il},name.ilike.${il},status.ilike.${il}`)
    .order("created_at", { ascending: false })
  if (startIso) q = q.gte("created_at", startIso)
  if (endIso) q = q.lte("created_at", endIso)

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  const hits = (rows ?? []).map((u) => {
    const row = u as Record<string, unknown>
    const id = String(row.id ?? "")
    const r = rankUserTextMatch(row, p)
    const label = String(row.email ?? row.name ?? id)
    const secondary_label = row.name ? String(row.name) : null
    return {
      source_table: "users",
      matched_field: r.matched_field,
      match_type: r.match_type,
      record_id: id,
      label,
      secondary_label,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      relevance_score: r.relevance_score,
      preview: row as Record<string, unknown>,
    }
  })

  return { hits, total: count ?? hits.length }
}

export async function fetchTeamsGlobalTextSearch(params: {
  supabase: SupabaseClient
  pattern: string
  offset: number
  limit: number
  startIso?: string | null
  endIso?: string | null
}): Promise<{ hits: UnifiedSearchResultRow[]; total: number }> {
  const { supabase, pattern, offset, limit, startIso, endIso } = params
  const p = pattern.trim()
  if (!p) return { hits: [], total: 0 }

  const esc = escapeIlikePattern(p)
  const il = `%${esc}%`
  let q = supabase
    .from("teams")
    .select("id, name, head_coach_user_id, team_status, subscription_status, created_at", { count: "exact" })
    .or(`name.ilike.${il},team_status.ilike.${il},subscription_status.ilike.${il}`)
    .order("created_at", { ascending: false })
  if (startIso) q = q.gte("created_at", startIso)
  if (endIso) q = q.lte("created_at", endIso)

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  const hits = (rows ?? []).map((t) => {
    const row = t as Record<string, unknown>
    const id = String(row.id ?? "")
    const r = rankTeamTextMatch(row, p)
    return {
      source_table: "teams",
      matched_field: r.matched_field,
      match_type: r.match_type,
      record_id: id,
      label: String(row.name ?? id),
      secondary_label: row.head_coach_user_id ? String(row.head_coach_user_id) : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      relevance_score: r.relevance_score,
      preview: row as Record<string, unknown>,
    }
  })

  return { hits, total: count ?? hits.length }
}

export async function fetchAuditLogsGlobalTextSearch(params: {
  supabase: SupabaseClient
  pattern: string
  offset: number
  limit: number
  startIso?: string | null
  endIso?: string | null
}): Promise<{ hits: UnifiedSearchResultRow[]; total: number }> {
  const { supabase, pattern, offset, limit, startIso, endIso } = params
  const p = pattern.trim()
  if (!p) return { hits: [], total: 0 }

  const esc = escapeIlikePattern(p)
  const il = `%${esc}%`
  let q = supabase
    .from("audit_logs")
    .select(AUDIT_LOG_COLUMNS, { count: "exact" })
    .or(`action_type.ilike.${il},target_id.ilike.${il},target_type.ilike.${il}`)
    .order("created_at", { ascending: false })
  if (startIso) q = q.gte("created_at", startIso)
  if (endIso) q = q.lte("created_at", endIso)

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  const needle = p.toLowerCase()
  const hits = (rows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>
    const id = String(row.id ?? "")
    const at = String(row.action_type ?? row.action ?? "").toLowerCase()
    const tid = String(row.target_id ?? "").toLowerCase()
    let matched_field = "audit_logs.action_type"
    let match_type: MatchType = "text_contains"
    let score = 420
    if (at === needle) {
      match_type = "action_type_exact"
      score = 705
    } else if (at.includes(needle)) {
      match_type = "action_type_partial"
      score = 640
    } else if (tid.includes(needle)) {
      matched_field = "audit_logs.target_id"
      match_type = "text_contains"
      score = 430
    }
    const pr = pickAuditRow(row)
    return {
      source_table: "audit_logs",
      matched_field,
      match_type,
      record_id: id,
      label: pr.action_type || id,
      secondary_label: pr.target_id,
      created_at: pr.created_at,
      relevance_score: score,
      preview: pr as unknown as Record<string, unknown>,
    }
  })

  return { hits, total: count ?? hits.length }
}

export async function fetchAgentActionsGlobalTextSearch(params: {
  supabase: SupabaseClient
  pattern: string
  offset: number
  limit: number
  startIso?: string | null
  endIso?: string | null
}): Promise<{ hits: UnifiedSearchResultRow[]; total: number }> {
  const { supabase, pattern, offset, limit, startIso, endIso } = params
  const p = pattern.trim()
  if (!p) return { hits: [], total: 0 }

  const esc = escapeIlikePattern(p)
  const il = `%${esc}%`
  let q = supabase
    .from("agent_actions")
    .select("id, team_id, user_id, action_type, executed_at, undone, cost_in_credits", { count: "exact" })
    .ilike("action_type", il)
    .order("executed_at", { ascending: false })
  if (startIso) q = q.gte("executed_at", startIso)
  if (endIso) q = q.lte("executed_at", endIso)

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  const needle = p.toLowerCase()
  const hits = (rows ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const id = String(row.id ?? "")
    const at = String(row.action_type ?? "").toLowerCase()
    const exact = at === needle
    return {
      source_table: "agent_actions",
      matched_field: "agent_actions.action_type",
      match_type: (exact ? "action_type_exact" : "action_type_partial") as MatchType,
      record_id: id,
      label: String(row.action_type ?? id),
      secondary_label: row.team_id ? String(row.team_id) : null,
      created_at: typeof row.executed_at === "string" ? row.executed_at : null,
      relevance_score: exact ? 695 : 630,
      preview: row as Record<string, unknown>,
    }
  })

  return { hits, total: count ?? hits.length }
}

export async function fetchSubscriptionsGlobalTextSearch(params: {
  supabase: SupabaseClient
  pattern: string
  offset: number
  limit: number
  startIso?: string | null
  endIso?: string | null
}): Promise<{ hits: UnifiedSearchResultRow[]; total: number }> {
  const { supabase, pattern, offset, limit, startIso, endIso } = params
  const p = pattern.trim()
  if (!p) return { hits: [], total: 0 }

  const esc = escapeIlikePattern(p)
  const il = `%${esc}%`
  let q = supabase
    .from("subscriptions")
    .select("id, team_id, status, stripe_subscription_id, created_at", { count: "exact" })
    .or(`status.ilike.${il},stripe_subscription_id.ilike.${il}`)
    .order("created_at", { ascending: false })

  if (startIso) q = q.gte("created_at", startIso)
  if (endIso) q = q.lte("created_at", endIso)

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error

  const hits = (rows ?? []).map((s) => {
    const row = s as Record<string, unknown>
    const id = String(row.id ?? "")
    return {
      source_table: "subscriptions",
      matched_field: "subscriptions.status",
      match_type: "text_contains" as MatchType,
      record_id: id,
      label: String(row.stripe_subscription_id ?? row.team_id ?? id),
      secondary_label: row.status ? String(row.status) : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      relevance_score: 510,
      preview: row as Record<string, unknown>,
    }
  })

  return { hits, total: count ?? hits.length }
}

export async function fetchEntitiesByFullUuid(supabase: SupabaseClient, uuid: string) {
  const id = uuid.toLowerCase()
  const hits: { source_table: string; entity_id: string; record: Record<string, unknown> | null }[] = []

  const [u, t, s] = await Promise.all([
    supabase.from("users").select("*").eq("id", id).maybeSingle(),
    supabase.from("teams").select("*").eq("id", id).maybeSingle(),
    supabase.from("subscriptions").select("*, teams(id, name)").eq("id", id).maybeSingle(),
  ])

  if (u.data) hits.push({ source_table: "users", entity_id: id, record: u.data as Record<string, unknown> })
  if (t.data) hits.push({ source_table: "teams", entity_id: id, record: t.data as Record<string, unknown> })
  if (s.data) hits.push({ source_table: "subscriptions", entity_id: id, record: s.data as Record<string, unknown> })

  return { hits, errors: [u.error, t.error, s.error].filter(Boolean) }
}

/** Matches Postgres RETURNS TABLE from admin_dev_console_uuid_fragment(text). */
export type UuidFragmentRpcRow = {
  source_table: string
  matched_column: string
  record_id: string
  label: string
  created_at: string | null
}

export async function fetchPartialUuidRpc(supabase: SupabaseClient, fragment: string): Promise<UuidFragmentRpcRow[]> {
  const { data, error } = await supabase.rpc("admin_dev_console_uuid_fragment", {
    fragment: fragment.trim().toLowerCase(),
  })

  if (error) {
    console.warn("[dev-console] uuid fragment rpc:", error.message)
    return []
  }

  const rows = (data ?? []) as Partial<UuidFragmentRpcRow &
    Record<"sourceTable" | "matchedColumn" | "recordId" | "createdAt", unknown>>[]
  return rows
    .map((r) => ({
      source_table: String(r.source_table ?? r.sourceTable ?? ""),
      matched_column: String(r.matched_column ?? r.matchedColumn ?? ""),
      record_id: String(r.record_id ?? r.recordId ?? ""),
      label: String(r.label ?? ""),
      created_at:
        typeof r.created_at === "string"
          ? r.created_at
          : typeof r.createdAt === "string"
            ? r.createdAt
            : null,
    }))
    .filter((r) => r.source_table && r.record_id)
}

export async function fetchEntitySummary(
  supabase: SupabaseClient,
  sourceTable: string,
  entityId: string
): Promise<Record<string, unknown> | null> {
  const id = entityId.toLowerCase()
  if (sourceTable === "users") {
    const { data } = await supabase.from("users").select("id, email, name, role, status").eq("id", id).maybeSingle()
    return (data as Record<string, unknown>) ?? null
  }
  if (sourceTable === "teams") {
    const { data } = await supabase.from("teams").select("id, name, team_status, subscription_status").eq("id", id).maybeSingle()
    return (data as Record<string, unknown>) ?? null
  }
  if (sourceTable === "subscriptions") {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, team_id, status, stripe_subscription_id, created_at")
      .eq("id", id)
      .maybeSingle()
    return (data as Record<string, unknown>) ?? null
  }
  return null
}

export async function fetchAgentActionsForPartialEntities(params: {
  supabase: SupabaseClient
  userIds: string[]
  teamIds: string[]
  offset: number
  limit: number
}) {
  const { supabase, userIds, teamIds, offset, limit } = params
  const u = userIds.filter(Boolean).slice(0, 40)
  const t = teamIds.filter(Boolean).slice(0, 40)
  if (u.length === 0 && t.length === 0) {
    return { rows: [] as Record<string, unknown>[], total: 0 }
  }

  let q = supabase
    .from("agent_actions")
    .select("id, team_id, user_id, action_type, executed_at, undo_available_until, undone, cost_in_credits", {
      count: "exact",
    })
    .order("executed_at", { ascending: false })

  if (u.length && t.length) {
    q = q.or(`user_id.in.(${u.join(",")}),team_id.in.(${t.join(",")})`)
  } else if (u.length) {
    q = q.in("user_id", u)
  } else if (t.length) {
    q = q.in("team_id", t)
  } else {
    return { rows: [], total: 0 }
  }

  const { data: rows, error, count } = await q.range(offset, offset + limit - 1)
  if (error) throw error
  return { rows: rows ?? [], total: count ?? rows?.length ?? 0 }
}

export async function loadEntityRecord(
  supabase: SupabaseClient,
  sourceTable: string,
  entityId: string
): Promise<Record<string, unknown> | null> {
  const id = entityId.toLowerCase()
  if (sourceTable === "users") {
    const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle()
    return (data as Record<string, unknown>) ?? null
  }
  if (sourceTable === "teams") {
    const { data } = await supabase.from("teams").select("*").eq("id", id).maybeSingle()
    return (data as Record<string, unknown>) ?? null
  }
  if (sourceTable === "subscriptions") {
    const { data } = await supabase.from("subscriptions").select("*, teams(id, name)").eq("id", id).maybeSingle()
    return (data as Record<string, unknown>) ?? null
  }
  return null
}
