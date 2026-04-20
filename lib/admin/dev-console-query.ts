import type { SupabaseClient } from "@supabase/supabase-js"

const UUID_FULL =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

const PARTIAL_ONLY = /^[0-9a-fA-F-]+$/

export type ParsedGlobalQuery =
  | { kind: "empty" }
  | { kind: "uuid_full"; uuid: string }
  | { kind: "uuid_partial"; fragment: string }
  | { kind: "time_range"; startIso: string; endIso: string }

export type EntityTableFilter = "users" | "teams" | "subscriptions" | "audit_logs" | "agent_actions" | "creations"

export function stripHyphens(s: string): string {
  return s.replace(/-/g, "")
}

/** Minimum hex chars (excluding hyphens) for partial UUID detection. */
export function partialUuidLooksLike(fragment: string): boolean {
  const hex = stripHyphens(fragment.trim())
  return hex.length >= 8 && /^[0-9a-fA-F]+$/.test(hex)
}

export function parseGlobalQuery(qRaw: string): ParsedGlobalQuery {
  const q = qRaw.trim()
  if (!q) return { kind: "empty" }

  const rangeFromSep = splitRange(q)
  if (rangeFromSep) {
    return { kind: "time_range", startIso: rangeFromSep.start.toISOString(), endIso: rangeFromSep.end.toISOString() }
  }

  if (UUID_FULL.test(q)) {
    return { kind: "uuid_full", uuid: q.toLowerCase() }
  }

  if (PARTIAL_ONLY.test(q) && partialUuidLooksLike(q)) {
    return { kind: "uuid_partial", fragment: q.trim().toLowerCase() }
  }

  const single = parseInstantOrDayRange(q)
  if (single) {
    return { kind: "time_range", startIso: single.start.toISOString(), endIso: single.end.toISOString() }
  }

  return { kind: "empty" }
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

function pickAuditRow(raw: Record<string, unknown>) {
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

export async function fetchPartialUuidRpc(
  supabase: SupabaseClient,
  fragment: string
): Promise<{ source_table: string; entity_id: string }[]> {
  const { data, error } = await supabase.rpc("admin_dev_console_uuid_fragment", {
    fragment: fragment.trim().toLowerCase(),
  })

  if (error) {
    console.warn("[dev-console] uuid fragment rpc:", error.message)
    return []
  }

  const rows = (data ?? []) as { source_table?: string; entity_id?: string; sourceTable?: string; entityId?: string }[]
  return rows
    .map((r) => ({
      source_table: (r.source_table ?? r.sourceTable ?? "") as string,
      entity_id: (r.entity_id ?? r.entityId ?? "") as string,
    }))
    .filter((r) => r.source_table && r.entity_id)
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

  const ors: string[] = []
  if (u.length) ors.push(`user_id.in.(${u.join(",")})`)
  if (t.length) ors.push(`team_id.in.(${t.join(",")})`)

  let q = supabase
    .from("agent_actions")
    .select("id, team_id, user_id, action_type, executed_at, undo_available_until, undone, cost_in_credits", {
      count: "exact",
    })
    .or(ors.join(","))
    .order("executed_at", { ascending: false })

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
