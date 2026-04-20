import type { SupabaseClient } from "@supabase/supabase-js"
import { buildSearchableRegistry } from "@/lib/admin/dev-console-registry"
import {
  classifyDbError,
  devConsoleLog,
  sanitizeClientMessage,
} from "@/lib/admin/dev-console-logging"
import type {
  DevConsolePagination,
  DevConsoleQuerySummary,
  DevConsoleScopeName,
  FailedScopePayload,
  GroupedResults,
  MatchType,
  UnifiedSearchResultRow,
  DevConsoleWarning,
} from "@/lib/admin/dev-console-types"
import {
  fetchAgentActionsForPartialEntities,
  fetchAgentActionsForUuidFiltered,
  fetchAgentActionsGlobalTextSearch,
  fetchAgentActionsRange,
  fetchAuditLogsByActorIds,
  fetchAuditLogsForUuidFiltered,
  fetchAuditLogsGlobalTextSearch,
  fetchAuditLogsRange,
  fetchAuditLogsTargetPartial,
  fetchAuditLogsWhereTargetIds,
  fetchEntitiesByFullUuid,
  fetchEntitySummary,
  fetchPartialUuidRpc,
  fetchRecentCreations,
  fetchSubscriptionsGlobalTextSearch,
  fetchTeamsGlobalTextSearch,
  fetchUsersByEmailSearch,
  fetchUsersGlobalTextSearch,
  isFullUuid,
  looksLikeEmailQuery,
  parseGlobalQuery,
  partialUuidLooksLike,
  pickAuditRow,
  type EntityTableFilter,
  type ParsedGlobalQuery,
} from "@/lib/admin/dev-console-query"

type AuditRow = ReturnType<typeof pickAuditRow>

export type DevConsoleGetResponse = {
  ok: true
  request_id: string
  query_summary: DevConsoleQuerySummary
  mode: string
  inspectId?: string
  primaryEntity?: { source_table: string; record: Record<string, unknown> } | null
  /** Unified ranked rows */
  results: UnifiedSearchResultRow[]
  grouped_results: GroupedResults
  warnings: DevConsoleWarning[]
  failed_scopes: FailedScopePayload[]
  available_scopes: string[]
  pagination: DevConsolePagination
  /** Legacy shapes for existing UI */
  browseWindowApplied?: boolean
  parsed?: ParsedGlobalQuery
  entityHits: unknown[]
  auditLogs: { rows: AuditRow[]; total: number }
  agentActions: { rows: Record<string, unknown>[]; total: number }
  creations?: { users: unknown[]; teams: unknown[] }
  entityTotal?: number
}

const THIRTY_D = 30 * 24 * 60 * 60 * 1000

function allow(filters: Set<EntityTableFilter> | null, table: EntityTableFilter): boolean {
  return filters == null || filters.has(table)
}

async function scopeRun<T>(
  requestId: string,
  scopeName: DevConsoleScopeName | string,
  fn: () => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; failure: FailedScopePayload }> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err: unknown) {
    const internal = err instanceof Error ? err.message : String(err)
    const safe_message = sanitizeClientMessage(err)
    const error_code = classifyDbError(internal)
    devConsoleLog(requestId, "warn", "dev_console_scope_failed", {
      scope: scopeName,
      error_code,
      internal: internal.slice(0, 500),
    })
    return {
      ok: false,
      failure: {
        scope: scopeName,
        error_code,
        safe_message,
      },
    }
  }
}

function emptyAudit(): { rows: AuditRow[]; total: number } {
  return { rows: [], total: 0 }
}

function dedupeAuditRows(rows: AuditRow[]): AuditRow[] {
  const seen = new Set<string>()
  const out: AuditRow[] = []
  for (const r of rows) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}

function auditRowMatchesFilters(
  row: AuditRow,
  startIso: string | null,
  endIso: string | null,
  actionTypeFilter: string | null
): boolean {
  const t = new Date(row.created_at).getTime()
  if (startIso != null && t < new Date(startIso).getTime()) return false
  if (endIso != null && t > new Date(endIso).getTime()) return false
  if (actionTypeFilter?.trim() && row.action_type !== actionTypeFilter.trim()) return false
  return true
}

function groupResults(rows: UnifiedSearchResultRow[]): GroupedResults {
  const g: GroupedResults = {}
  for (const r of rows) {
    const k = r.source_table
    if (!g[k]) g[k] = []
    g[k].push(r)
  }
  return g
}

function mergeFailed(
  failed: FailedScopePayload[],
  r: { ok: true; data: unknown } | { ok: false; failure: FailedScopePayload }
) {
  if (!r.ok) failed.push(r.failure)
}

function normalizeQueryTypeLabel(
  parsed: ParsedGlobalQuery,
  qRaw: string
): DevConsoleQuerySummary["normalized_query_type"] {
  if (parsed.kind === "empty") return "empty"
  if (parsed.kind === "uuid_full" || parsed.kind === "uuid_partial") {
    return parsed.kind === "uuid_full" ? "uuid_full" : "uuid_partial"
  }
  if (parsed.kind === "time_range" || parsed.kind === "relative_range") return "date_range"
  if (parsed.kind === "text_search") {
    const t = qRaw.trim().toLowerCase()
    if (looksLikeEmailQuery(qRaw.trim())) return "email"
    if (partialUuidLooksLike(t) && /^[0-9a-fA-F-]+$/.test(t)) return "uuid_partial"
    return "text"
  }
  return "text"
}

export async function runDevConsoleGet(params: {
  requestId: string
  supabase: SupabaseClient
  inspect: string
  q: string
  actionType: string | null
  tables: Set<EntityTableFilter> | null
  offset: number
  limit: number
  urlParamStart: string | null | undefined
  urlParamEnd: string | null | undefined
  searchMode: "global" | "trace"
}): Promise<DevConsoleGetResponse> {
  const {
    requestId,
    supabase,
    inspect,
    q,
    actionType,
    tables,
    offset,
    limit,
    urlParamStart,
    urlParamEnd,
    searchMode,
  } = params

  const registry = buildSearchableRegistry()
  const available_scopes = registry.map((m) => m.id)
  const warnings: DevConsoleWarning[] = []
  const failed_scopes: FailedScopePayload[] = []
  const unified: UnifiedSearchResultRow[] = []

  let paramStart = urlParamStart
  let paramEnd = urlParamEnd
  let parsed: ParsedGlobalQuery = parseGlobalQuery(q)

  if (paramStart === undefined && paramEnd === undefined && parsed.kind === "time_range") {
    paramStart = parsed.startIso
    paramEnd = parsed.endIso
  }

  if (parsed.kind === "relative_range") {
    paramStart = parsed.startIso
    paramEnd = parsed.endIso
  }

  const browseDefault =
    paramStart === undefined &&
    paramEnd === undefined &&
    !inspect.trim() &&
    parsed.kind === "empty" &&
    !q.trim()

  if (browseDefault) {
    paramStart = new Date(Date.now() - THIRTY_D).toISOString()
    paramEnd = new Date().toISOString()
  }

  devConsoleLog(requestId, "info", "dev_console_get", {
    selectedTables: tables ? [...tables] : "all",
    normalizedInput: parsed,
    mode: searchMode,
  })

  /** ---- Inspect UUID ---- */
  if (inspect.trim() && isFullUuid(inspect.trim())) {
    const id = inspect.trim().toLowerCase()

    const auditP = allow(tables, "audit_logs")
      ? scopeRun(requestId, "audit_logs", () =>
          fetchAuditLogsForUuidFiltered({
            supabase,
            uuid: id,
            startIso: paramStart ?? undefined,
            endIso: paramEnd ?? undefined,
            actionType,
            offset,
            limit,
          })
        )
      : Promise.resolve({ ok: true as const, data: emptyAudit() })

    const actionsP = allow(tables, "agent_actions")
      ? scopeRun(requestId, "agent_actions", () =>
          fetchAgentActionsForUuidFiltered({
            supabase,
            uuid: id,
            startIso: paramStart ?? undefined,
            endIso: paramEnd ?? undefined,
            offset,
            limit,
          })
        )
      : Promise.resolve({ ok: true as const, data: { rows: [], total: 0 } })

    const entitiesP = scopeRun(requestId, "uuid_entities", () => fetchEntitiesByFullUuid(supabase, id))

    const [auditR, actionsR, entitiesR] = await Promise.all([auditP, actionsP, entitiesP])

    mergeFailed(failed_scopes, auditR)
    mergeFailed(failed_scopes, actionsR)
    mergeFailed(failed_scopes, entitiesR)

    const audit = auditR.ok ? auditR.data : emptyAudit()
    const actions = actionsR.ok ? actionsR.data : { rows: [], total: 0 }
    const entities = entitiesR.ok ? entitiesR.data : { hits: [], errors: [] as unknown[] }

    if (entities.errors?.length) {
      warnings.push({
        message: "Some entity tables returned warnings while loading this UUID.",
        code: "entity_partial",
      })
    }

    for (const h of entities.hits) {
      unified.push({
        source_table: h.source_table,
        matched_field: `${h.source_table}.id`,
        match_type: "pk_uuid_exact",
        record_id: h.entity_id,
        label: String((h.record as Record<string, unknown>)?.email ?? (h.record as Record<string, unknown>)?.name ?? h.entity_id),
        secondary_label: null,
        created_at: typeof (h.record as Record<string, unknown>)?.created_at === "string"
          ? String((h.record as Record<string, unknown>).created_at)
          : null,
        relevance_score: 1000,
        preview: h.record ?? undefined,
      })
    }

    const primaryHit = entities.hits[0]
    const primaryEntity =
      primaryHit && primaryHit.record
        ? { source_table: primaryHit.source_table as "users" | "teams" | "subscriptions", record: primaryHit.record }
        : null

    const query_summary: DevConsoleQuerySummary = {
      normalized_query: id,
      normalized_query_type: "uuid_full",
      mode: "inspect",
    }

    return {
      ok: true,
      request_id: requestId,
      query_summary,
      mode: "inspect",
      inspectId: id,
      primaryEntity,
      results: unified.sort((a, b) => b.relevance_score - a.relevance_score),
      grouped_results: groupResults(unified),
      warnings,
      failed_scopes,
      available_scopes,
      pagination: { offset, limit },
      browseWindowApplied: false,
      entityHits: entities.hits,
      auditLogs: audit,
      agentActions: actions,
      parsed: { kind: "uuid_full", uuid: id },
    }
  }

  /** ---- Email ---- */
  if (q.trim() && looksLikeEmailQuery(q.trim()) && allow(tables, "users")) {
    const emailPattern = q.trim()
    const fetchCap = Math.min(100, offset + limit)

    const emailScope = await scopeRun(requestId, "users", () =>
      fetchUsersByEmailSearch({ supabase, pattern: emailPattern, offset: 0, limit: fetchCap })
    )
    mergeFailed(failed_scopes, emailScope)

    const extraResults = await Promise.all([
      allow(tables, "teams")
        ? scopeRun(requestId, "teams", () =>
            fetchTeamsGlobalTextSearch({
              supabase,
              pattern: emailPattern,
              offset: 0,
              limit: fetchCap,
              startIso: paramStart ?? null,
              endIso: paramEnd ?? null,
            })
          )
        : Promise.resolve({ ok: true as const, data: { hits: [] as UnifiedSearchResultRow[], total: 0 } }),
      allow(tables, "audit_logs")
        ? scopeRun(requestId, "audit_logs", () =>
            fetchAuditLogsGlobalTextSearch({
              supabase,
              pattern: emailPattern,
              offset: 0,
              limit: fetchCap,
              startIso: paramStart ?? null,
              endIso: paramEnd ?? null,
            })
          )
        : Promise.resolve({ ok: true as const, data: { hits: [] as UnifiedSearchResultRow[], total: 0 } }),
      allow(tables, "agent_actions")
        ? scopeRun(requestId, "agent_actions", () =>
            fetchAgentActionsGlobalTextSearch({
              supabase,
              pattern: emailPattern,
              offset: 0,
              limit: fetchCap,
              startIso: paramStart ?? null,
              endIso: paramEnd ?? null,
            })
          )
        : Promise.resolve({ ok: true as const, data: { hits: [] as UnifiedSearchResultRow[], total: 0 } }),
    ])

    for (const ex of extraResults) {
      mergeFailed(failed_scopes, ex)
      if (ex.ok) unified.push(...ex.data.hits)
    }

    const hits = emailScope.ok
      ? emailScope.data.hits.map((h) => {
          const row = h.summary as Record<string, unknown>
          return {
            source_table: "users",
            matched_field: h.matched_column,
            match_type: "email_partial" as MatchType,
            record_id: h.record_id,
            label: h.label,
            secondary_label: row?.name ? String(row.name) : null,
            created_at: h.created_at,
            relevance_score: 730,
            preview: row,
          }
        })
      : []

    unified.push(...hits)
    unified.sort((a, b) => b.relevance_score - a.relevance_score)

    const pagedUnified = unified.slice(offset, offset + limit)

    const auditRowsLegacy = pagedUnified
      .filter((u) => u.source_table === "audit_logs")
      .map((u) => u.preview as AuditRow | undefined)
      .filter(Boolean) as AuditRow[]
    const agentRowsLegacy = pagedUnified
      .filter((u) => u.source_table === "agent_actions")
      .map((u) => u.preview as Record<string, unknown> | undefined)
      .filter(Boolean) as Record<string, unknown>[]

    const entityHits = emailScope.ok
      ? emailScope.data.hits.map((h) => ({
          source_table: h.source_table,
          matched_column: h.matched_column,
          record_id: h.record_id,
          label: h.label,
          created_at: h.created_at,
          summary: h.summary,
        }))
      : []

    const query_summary: DevConsoleQuerySummary = {
      normalized_query: emailPattern,
      normalized_query_type: "email",
      mode: searchMode === "trace" ? "trace" : "global",
    }

    return {
      ok: true,
      request_id: requestId,
      query_summary,
      mode: "email_search",
      results: pagedUnified,
      grouped_results: groupResults(pagedUnified),
      warnings,
      failed_scopes,
      available_scopes,
      pagination: { offset, limit, total_hint: emailScope.ok ? emailScope.data.total : undefined },
      browseWindowApplied: false,
      parsed: { kind: "text_search", text: emailPattern },
      entityHits,
      auditLogs: { rows: auditRowsLegacy, total: unified.filter((u) => u.source_table === "audit_logs").length },
      agentActions: {
        rows: agentRowsLegacy,
        total: unified.filter((u) => u.source_table === "agent_actions").length,
      },
      entityTotal: emailScope.ok ? emailScope.data.total : 0,
    }
  }

  /** ---- UUID full ---- */
  if (parsed.kind === "uuid_full") {
    const id = parsed.uuid
    const entitiesP = allow(tables, "users") || allow(tables, "teams") || allow(tables, "subscriptions")
      ? scopeRun(requestId, "uuid_entities", () => fetchEntitiesByFullUuid(supabase, id))
      : Promise.resolve({ ok: true as const, data: { hits: [] as { source_table: string; entity_id: string; record: Record<string, unknown> | null }[], errors: [] } })

    const auditP = allow(tables, "audit_logs")
      ? scopeRun(requestId, "audit_logs", () =>
          fetchAuditLogsForUuidFiltered({
            supabase,
            uuid: id,
            startIso: paramStart ?? undefined,
            endIso: paramEnd ?? undefined,
            actionType,
            offset,
            limit,
          })
        )
      : Promise.resolve({ ok: true as const, data: emptyAudit() })

    const actionsP = allow(tables, "agent_actions")
      ? scopeRun(requestId, "agent_actions", () =>
          fetchAgentActionsForUuidFiltered({
            supabase,
            uuid: id,
            startIso: paramStart ?? undefined,
            endIso: paramEnd ?? undefined,
            offset,
            limit,
          })
        )
      : Promise.resolve({ ok: true as const, data: { rows: [], total: 0 } })

    const [entitiesR, auditR, actionsR] = await Promise.all([entitiesP, auditP, actionsP])
    mergeFailed(failed_scopes, entitiesR)
    mergeFailed(failed_scopes, auditR)
    mergeFailed(failed_scopes, actionsR)

    const entities = entitiesR.ok ? entitiesR.data : { hits: [], errors: [] }
    const audit = auditR.ok ? auditR.data : emptyAudit()
    const actions = actionsR.ok ? actionsR.data : { rows: [], total: 0 }

    for (const h of entities.hits) {
      unified.push({
        source_table: h.source_table,
        matched_field: `${h.source_table}.id`,
        match_type: "pk_uuid_exact",
        record_id: h.entity_id,
        label: String((h.record as Record<string, unknown>)?.email ?? (h.record as Record<string, unknown>)?.name ?? h.entity_id),
        relevance_score: 1000,
        preview: h.record ?? undefined,
        created_at:
          typeof (h.record as Record<string, unknown>)?.created_at === "string"
            ? String((h.record as Record<string, unknown>).created_at)
            : null,
      })
    }
    for (const row of audit.rows) {
      unified.push({
        source_table: "audit_logs",
        matched_field: row.target_id === id ? "audit_logs.target_id" : "audit_logs.actor_id",
        match_type: "related_activity",
        record_id: row.id,
        label: row.action_type,
        secondary_label: row.target_id,
        created_at: row.created_at,
        relevance_score: 400,
      })
    }
    for (const row of actions.rows) {
      unified.push({
        source_table: "agent_actions",
        matched_field: row.user_id === id ? "agent_actions.user_id" : "agent_actions.team_id",
        match_type: "related_activity",
        record_id: String(row.id ?? ""),
        label: String(row.action_type ?? ""),
        secondary_label: String(row.team_id ?? ""),
        created_at: typeof row.executed_at === "string" ? row.executed_at : null,
        relevance_score: 400,
      })
    }

    unified.sort((a, b) => b.relevance_score - a.relevance_score)

    const query_summary: DevConsoleQuerySummary = {
      normalized_query: id,
      normalized_query_type: "uuid_full",
      mode: searchMode === "trace" ? "trace" : "global",
    }

    return {
      ok: true,
      request_id: requestId,
      query_summary,
      mode: searchMode === "trace" ? "trace" : "uuid_full",
      results: unified,
      grouped_results: groupResults(unified),
      warnings,
      failed_scopes,
      available_scopes,
      pagination: { offset, limit },
      browseWindowApplied: browseDefault,
      parsed,
      entityHits: entities.hits,
      auditLogs: audit,
      agentActions: actions,
    }
  }

  /** ---- UUID partial ---- */
  if (parsed.kind === "uuid_partial") {
    const fragment = parsed.fragment

    const rpcP = scopeRun(requestId, "uuid_fragment_rpc", async () => fetchPartialUuidRpc(supabase, fragment))

    const rpcR = await rpcP
    mergeFailed(failed_scopes, rpcR)
    const rpcRows = rpcR.ok ? rpcR.data : []

    const userIds = rpcRows.filter((r) => r.source_table === "users").map((r) => r.record_id)
    const teamIds = rpcRows.filter((r) => r.source_table === "teams").map((r) => r.record_id)
    const allIds = [
      ...userIds,
      ...teamIds,
      ...rpcRows.filter((r) => r.source_table === "subscriptions").map((r) => r.record_id),
    ]

    const summariesOr = await Promise.all(
      rpcRows.slice(0, 25).map(async (r) => {
        const summary = await fetchEntitySummary(supabase, r.source_table, r.record_id).catch(() => null)
        return {
          source_table: r.source_table,
          matched_column: r.matched_column,
          record_id: r.record_id,
          label: r.label,
          created_at: r.created_at,
          summary,
        }
      })
    )

    const auditByTargetFragP = allow(tables, "audit_logs")
      ? scopeRun(requestId, "audit_logs", () =>
          fetchAuditLogsTargetPartial({
            supabase,
            fragment,
            offset: 0,
            limit: Math.min(200, offset + limit + 50),
          })
        )
      : Promise.resolve({ ok: true as const, data: emptyAudit() })

    const auditByActorsP =
      allow(tables, "audit_logs") && userIds.length
        ? scopeRun(requestId, "audit_logs", () =>
            fetchAuditLogsByActorIds({
              supabase,
              actorIds: userIds,
              startIso: paramStart ?? undefined,
              endIso: paramEnd ?? undefined,
              actionType,
              offset: 0,
              limit: Math.min(200, offset + limit + 50),
            })
          )
        : Promise.resolve({ ok: true as const, data: emptyAudit() })

    const auditByTargetIdsP =
      allow(tables, "audit_logs") && allIds.length
        ? scopeRun(requestId, "audit_logs", () =>
            fetchAuditLogsWhereTargetIds({
              supabase,
              targetIds: allIds,
              startIso: paramStart ?? undefined,
              endIso: paramEnd ?? undefined,
              actionType,
              offset: 0,
              limit: Math.min(200, offset + limit + 50),
            })
          )
        : Promise.resolve({ ok: true as const, data: emptyAudit() })

    const agentPartialP =
      allow(tables, "agent_actions") && (userIds.length || teamIds.length)
        ? scopeRun(requestId, "agent_actions", () =>
            fetchAgentActionsForPartialEntities({
              supabase,
              userIds,
              teamIds,
              offset,
              limit,
            })
          )
        : Promise.resolve({ ok: true as const, data: { rows: [], total: 0 } })

    const [a1, a2, a3, ag] = await Promise.all([auditByTargetFragP, auditByActorsP, auditByTargetIdsP, agentPartialP])

    mergeFailed(failed_scopes, a1)
    mergeFailed(failed_scopes, a2)
    mergeFailed(failed_scopes, a3)
    mergeFailed(failed_scopes, ag)

    const auditByTargetFrag = a1.ok ? a1.data : emptyAudit()
    const auditByActors = a2.ok ? a2.data : emptyAudit()
    const auditByTargetIds = a3.ok ? a3.data : emptyAudit()
    const agentPartial = ag.ok ? ag.data : { rows: [], total: 0 }

    const mergedAudit = dedupeAuditRows([
      ...auditByTargetFrag.rows,
      ...auditByActors.rows,
      ...auditByTargetIds.rows,
    ])
      .filter((row) => auditRowMatchesFilters(row, paramStart ?? null, paramEnd ?? null, actionType))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const pagedAudit = mergedAudit.slice(offset, offset + limit)

    for (const s of summariesOr) {
      unified.push({
        source_table: s.source_table,
        matched_field: s.matched_column,
        match_type: "uuid_partial",
        record_id: s.record_id,
        label: s.label,
        created_at: s.created_at,
        relevance_score: 800,
        preview: (s.summary ?? undefined) as Record<string, unknown> | undefined,
      })
    }
    for (const row of pagedAudit) {
      unified.push({
        source_table: "audit_logs",
        matched_field: "audit_logs.target_id",
        match_type: "related_activity",
        record_id: row.id,
        label: row.action_type,
        secondary_label: row.target_id,
        created_at: row.created_at,
        relevance_score: 400,
      })
    }
    for (const row of agentPartial.rows) {
      unified.push({
        source_table: "agent_actions",
        matched_field: "agent_actions.user_id",
        match_type: "related_activity",
        record_id: String(row.id ?? ""),
        label: String(row.action_type ?? ""),
        created_at: typeof row.executed_at === "string" ? row.executed_at : null,
        relevance_score: 400,
      })
    }

    unified.sort((a, b) => b.relevance_score - a.relevance_score)

    const query_summary: DevConsoleQuerySummary = {
      normalized_query: fragment,
      normalized_query_type: "uuid_partial",
      mode: searchMode === "trace" ? "trace" : "global",
    }

    return {
      ok: true,
      request_id: requestId,
      query_summary,
      mode: searchMode === "trace" ? "trace" : "uuid_partial",
      results: unified,
      grouped_results: groupResults(unified),
      warnings,
      failed_scopes,
      available_scopes,
      pagination: { offset, limit },
      browseWindowApplied: browseDefault,
      parsed,
      entityHits: summariesOr,
      auditLogs: { rows: pagedAudit, total: mergedAudit.length },
      agentActions: agentPartial,
    }
  }

  /** ---- Global text search (multi-scope, isolated failures) ---- */
  if (parsed.kind === "text_search") {
    const needle = parsed.text
    const fetchCap = Math.min(100, offset + limit)

    const pushScope = async (
      name: DevConsoleScopeName,
      fn: () => Promise<{ hits: UnifiedSearchResultRow[]; total: number }>
    ) => {
      const r = await scopeRun(requestId, name, fn)
      mergeFailed(failed_scopes, r)
      if (r.ok) unified.push(...r.data.hits)
    }

    const tasks: Promise<void>[] = []
    if (allow(tables, "users"))
      tasks.push(pushScope("users", () => fetchUsersGlobalTextSearch({ supabase, pattern: needle, offset: 0, limit: fetchCap, startIso: paramStart ?? null, endIso: paramEnd ?? null })))
    if (allow(tables, "teams"))
      tasks.push(pushScope("teams", () => fetchTeamsGlobalTextSearch({ supabase, pattern: needle, offset: 0, limit: fetchCap, startIso: paramStart ?? null, endIso: paramEnd ?? null })))
    if (allow(tables, "subscriptions"))
      tasks.push(
        pushScope("subscriptions", () =>
          fetchSubscriptionsGlobalTextSearch({ supabase, pattern: needle, offset: 0, limit: fetchCap, startIso: paramStart ?? null, endIso: paramEnd ?? null })
        )
      )
    if (allow(tables, "audit_logs"))
      tasks.push(
        pushScope("audit_logs", () =>
          fetchAuditLogsGlobalTextSearch({ supabase, pattern: needle, offset: 0, limit: fetchCap, startIso: paramStart ?? null, endIso: paramEnd ?? null })
        )
      )
    if (allow(tables, "agent_actions"))
      tasks.push(
        pushScope("agent_actions", () =>
          fetchAgentActionsGlobalTextSearch({ supabase, pattern: needle, offset: 0, limit: fetchCap, startIso: paramStart ?? null, endIso: paramEnd ?? null })
        )
      )

    await Promise.all(tasks)

    unified.sort((a, b) => b.relevance_score - a.relevance_score)
    const pagedUnified = unified.slice(offset, offset + limit)

    let creationsOut: { users: unknown[]; teams: unknown[] } | undefined
    const cr = await scopeRun(requestId, "creations", async () => {
      if (!(allow(tables, "creations") && paramStart && paramEnd)) return { users: [], teams: [], errors: [] as string[] }
      return fetchRecentCreations({
        supabase,
        startIso: paramStart,
        endIso: paramEnd,
        limit,
      })
    })
    mergeFailed(failed_scopes, cr)
    if (cr.ok && (cr.data.users.length || cr.data.teams.length)) {
      creationsOut = { users: cr.data.users, teams: cr.data.teams }
      if (cr.data.errors?.length) warnings.push({ message: cr.data.errors.join("; "), scope: "creations" })
    }

    const entityLike = unified.filter(
      (u) => u.source_table === "users" || u.source_table === "teams" || u.source_table === "subscriptions"
    )

    const auditLegacy = pagedUnified
      .filter((u) => u.source_table === "audit_logs")
      .map((u) => u.preview as AuditRow | undefined)
      .filter(Boolean) as AuditRow[]
    const agentLegacy = pagedUnified
      .filter((u) => u.source_table === "agent_actions")
      .map((u) => u.preview as Record<string, unknown> | undefined)
      .filter(Boolean) as Record<string, unknown>[]

    const query_summary: DevConsoleQuerySummary = {
      normalized_query: needle,
      normalized_query_type: normalizeQueryTypeLabel(parsed, q),
      mode: searchMode === "trace" ? "trace" : "global",
      browse_window_applied: browseDefault,
    }

    return {
      ok: true,
      request_id: requestId,
      query_summary,
      mode: searchMode === "trace" ? "trace" : "global_text",
      results: pagedUnified,
      grouped_results: groupResults(pagedUnified),
      warnings,
      failed_scopes,
      available_scopes,
      pagination: { offset, limit },
      browseWindowApplied: browseDefault,
      parsed,
      entityHits: entityLike.map((r) => ({
        source_table: r.source_table,
        matched_column: r.matched_field,
        record_id: r.record_id,
        label: r.label,
        created_at: r.created_at ?? null,
        summary: r.preview ?? {},
      })),
      auditLogs: {
        rows: auditLegacy,
        total: unified.filter((u) => u.source_table === "audit_logs").length,
      },
      agentActions: {
        rows: agentLegacy,
        total: unified.filter((u) => u.source_table === "agent_actions").length,
      },
      creations: creationsOut,
    }
  }

  /** ---- Time window / browse (empty query or time-only) ---- */
  const creationsCr = await scopeRun(requestId, "creations", async () => {
    if (!(allow(tables, "creations") && paramStart && paramEnd)) return { users: [], teams: [], errors: [] as string[] }
    return fetchRecentCreations({
      supabase,
      startIso: paramStart,
      endIso: paramEnd,
      limit,
    })
  })
  mergeFailed(failed_scopes, creationsCr)

  let creations: { users: unknown[]; teams: unknown[] } | undefined
  if (creationsCr.ok && creationsCr.data && (creationsCr.data.users.length || creationsCr.data.teams.length)) {
    creations = { users: creationsCr.data.users, teams: creationsCr.data.teams }
    if (creationsCr.data.errors?.length) warnings.push({ message: creationsCr.data.errors.join("; "), scope: "creations" })
  }

  const auditRangeP = allow(tables, "audit_logs")
    ? scopeRun(requestId, "audit_logs", () =>
        fetchAuditLogsRange({
          supabase,
          startIso: paramStart ?? undefined,
          endIso: paramEnd ?? undefined,
          actionType,
          actorId: undefined,
          targetIdLike: undefined,
          offset,
          limit,
        })
      )
    : Promise.resolve({ ok: true as const, data: emptyAudit() })

  const agentRangeP = allow(tables, "agent_actions")
    ? scopeRun(requestId, "agent_actions", () =>
        fetchAgentActionsRange({
          supabase,
          startIso: paramStart ?? undefined,
          endIso: paramEnd ?? undefined,
          userId: undefined,
          teamId: undefined,
          offset,
          limit,
        })
      )
    : Promise.resolve({ ok: true as const, data: { rows: [], total: 0 } })

  const [ar, gr] = await Promise.all([auditRangeP, agentRangeP])
  mergeFailed(failed_scopes, ar)
  mergeFailed(failed_scopes, gr)

  const auditRange = ar.ok ? ar.data : emptyAudit()
  const agentRange = gr.ok ? gr.data : { rows: [], total: 0 }

  const query_summary: DevConsoleQuerySummary = {
    normalized_query: q.trim(),
    normalized_query_type: browseDefault ? "empty" : "date_range",
    mode: browseDefault ? "browse" : "time_window",
    browse_window_applied: browseDefault,
  }

  return {
    ok: true,
    request_id: requestId,
    query_summary,
    mode: browseDefault ? "browse" : "time_window",
    results: [],
    grouped_results: {},
    warnings,
    failed_scopes,
    available_scopes,
    pagination: { offset, limit },
    browseWindowApplied: browseDefault,
    parsed,
    entityHits: [],
    auditLogs: auditRange,
    agentActions: agentRange,
    creations,
  }
}
