import { NextResponse } from "next/server"
import { requireAdminRoleForApi } from "@/lib/permissions/platform-permissions"
import {
  fetchAgentActionsForPartialEntities,
  fetchAgentActionsForUuidFiltered,
  fetchAgentActionsRange,
  fetchAuditLogsByActorIds,
  fetchAuditLogsForUuidFiltered,
  fetchAuditLogsRange,
  fetchAuditLogsTargetPartial,
  fetchAuditLogsWhereTargetIds,
  fetchEntitiesByFullUuid,
  fetchEntitySummary,
  fetchPartialUuidRpc,
  fetchRecentCreations,
  isFullUuid,
  normalizeLimit,
  normalizeOffset,
  parseGlobalQuery,
  parseTableFilters,
  type EntityTableFilter,
} from "@/lib/admin/dev-console-query"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export const runtime = "nodejs"

const THIRTY_D = 30 * 24 * 60 * 60 * 1000

function allow(filters: Set<EntityTableFilter> | null, table: EntityTableFilter): boolean {
  return filters == null || filters.has(table)
}

type AuditRow = {
  id: string
  action_type: string
  actor_id: string
  target_type: string | null
  target_id: string | null
  metadata_json: unknown
  created_at: string
  team_id: string | null
}

export async function GET(request: Request) {
  const gate = await requireAdminRoleForApi()
  if (!gate.ok) {
    return gate.response
  }

  const url = new URL(request.url)
  const inspect = url.searchParams.get("inspect")?.trim() ?? ""
  const q = url.searchParams.get("q")?.trim() ?? ""
  const actionType = url.searchParams.get("actionType")?.trim() || null
  const tables = parseTableFilters(url.searchParams.get("tables"))

  const offset = normalizeOffset(Number(url.searchParams.get("offset")))
  const limit = normalizeLimit(Number(url.searchParams.get("limit")), 50, 100)

  const hasStart = url.searchParams.has("start")
  const hasEnd = url.searchParams.has("end")
  let paramStart: string | null | undefined = hasStart ? url.searchParams.get("start")?.trim() || null : undefined
  let paramEnd: string | null | undefined = hasEnd ? url.searchParams.get("end")?.trim() || null : undefined

  const supabase = getSupabaseServer()

  try {
    if (inspect && isFullUuid(inspect)) {
      const id = inspect.toLowerCase()

      const [audit, actions, entities] = await Promise.all([
        allow(tables, "audit_logs")
          ? fetchAuditLogsForUuidFiltered({
              supabase,
              uuid: id,
              startIso: paramStart ?? undefined,
              endIso: paramEnd ?? undefined,
              actionType,
              offset,
              limit,
            })
          : Promise.resolve({ rows: [] as AuditRow[], total: 0 }),
        allow(tables, "agent_actions")
          ? fetchAgentActionsForUuidFiltered({
              supabase,
              uuid: id,
              startIso: paramStart ?? undefined,
              endIso: paramEnd ?? undefined,
              offset,
              limit,
            })
          : Promise.resolve({ rows: [], total: 0 }),
        fetchEntitiesByFullUuid(supabase, id),
      ])

      const primaryHit = entities.hits[0]
      const primaryEntity =
        primaryHit && primaryHit.record
          ? { source_table: primaryHit.source_table as "users" | "teams" | "subscriptions", record: primaryHit.record }
          : null

      return NextResponse.json({
        ok: true as const,
        mode: "inspect" as const,
        inspectId: id,
        primaryEntity,
        entityHits: entities.hits,
        auditLogs: audit,
        agentActions: actions,
        warnings: entities.errors?.length ? entities.errors.map((e) => String(e)) : undefined,
      })
    }

    const parsed = parseGlobalQuery(q)

    if (paramStart === undefined && paramEnd === undefined && parsed.kind === "time_range") {
      paramStart = parsed.startIso
      paramEnd = parsed.endIso
    }

    const browseDefault =
      paramStart === undefined &&
      paramEnd === undefined &&
      !inspect &&
      parsed.kind === "empty" &&
      !q.trim()

    if (browseDefault) {
      paramStart = new Date(Date.now() - THIRTY_D).toISOString()
      paramEnd = new Date().toISOString()
    }

    if (parsed.kind === "uuid_full") {
      const id = parsed.uuid
      const [entities, audit, actions] = await Promise.all([
        allow(tables, "users") || allow(tables, "teams") || allow(tables, "subscriptions")
          ? fetchEntitiesByFullUuid(supabase, id)
          : Promise.resolve({ hits: [] as { source_table: string; entity_id: string; record: Record<string, unknown> | null }[], errors: [] }),
        allow(tables, "audit_logs")
          ? fetchAuditLogsForUuidFiltered({
              supabase,
              uuid: id,
              startIso: paramStart ?? undefined,
              endIso: paramEnd ?? undefined,
              actionType,
              offset,
              limit,
            })
          : Promise.resolve({ rows: [] as AuditRow[], total: 0 }),
        allow(tables, "agent_actions")
          ? fetchAgentActionsForUuidFiltered({
              supabase,
              uuid: id,
              startIso: paramStart ?? undefined,
              endIso: paramEnd ?? undefined,
              offset,
              limit,
            })
          : Promise.resolve({ rows: [], total: 0 }),
      ])

      return NextResponse.json({
        ok: true as const,
        mode: "uuid_full" as const,
        parsed,
        browseWindowApplied: browseDefault,
        entityHits: entities.hits,
        auditLogs: audit,
        agentActions: actions,
        creations: undefined,
      })
    }

    if (parsed.kind === "uuid_partial") {
      const fragment = parsed.fragment
      const rpcRows = await fetchPartialUuidRpc(supabase, fragment)
      const userIds = rpcRows.filter((r) => r.source_table === "users").map((r) => r.record_id)
      const teamIds = rpcRows.filter((r) => r.source_table === "teams").map((r) => r.record_id)
      const allIds = [
        ...userIds,
        ...teamIds,
        ...rpcRows.filter((r) => r.source_table === "subscriptions").map((r) => r.record_id),
      ]

      const [summaries, auditByTargetFrag, auditByActors, auditByTargetIds, agentPartial] = await Promise.all([
        Promise.all(
          rpcRows.slice(0, 25).map(async (r) => ({
            source_table: r.source_table,
            matched_column: r.matched_column,
            record_id: r.record_id,
            label: r.label,
            created_at: r.created_at,
            summary: await fetchEntitySummary(supabase, r.source_table, r.record_id),
          }))
        ),
        allow(tables, "audit_logs")
          ? fetchAuditLogsTargetPartial({
              supabase,
              fragment,
              offset: 0,
              limit: Math.min(200, offset + limit + 50),
            })
          : Promise.resolve({ rows: [] as AuditRow[], total: 0 }),
        allow(tables, "audit_logs") && userIds.length
          ? fetchAuditLogsByActorIds({
              supabase,
              actorIds: userIds,
              startIso: paramStart ?? undefined,
              endIso: paramEnd ?? undefined,
              actionType,
              offset: 0,
              limit: Math.min(200, offset + limit + 50),
            })
          : Promise.resolve({ rows: [] as AuditRow[], total: 0 }),
        allow(tables, "audit_logs") && allIds.length
          ? fetchAuditLogsWhereTargetIds({
              supabase,
              targetIds: allIds,
              startIso: paramStart ?? undefined,
              endIso: paramEnd ?? undefined,
              actionType,
              offset: 0,
              limit: Math.min(200, offset + limit + 50),
            })
          : Promise.resolve({ rows: [] as AuditRow[], total: 0 }),
        allow(tables, "agent_actions") && (userIds.length || teamIds.length)
          ? fetchAgentActionsForPartialEntities({
              supabase,
              userIds,
              teamIds,
              offset,
              limit,
            })
          : Promise.resolve({ rows: [], total: 0 }),
      ])

      const mergedAudit = dedupeAuditRows([
        ...auditByTargetFrag.rows,
        ...auditByActors.rows,
        ...auditByTargetIds.rows,
      ])
        .filter((row) => auditRowMatchesFilters(row, paramStart ?? null, paramEnd ?? null, actionType))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      const pagedAudit = mergedAudit.slice(offset, offset + limit)

      return NextResponse.json({
        ok: true as const,
        mode: "uuid_partial" as const,
        parsed,
        browseWindowApplied: browseDefault,
        entityHits: summaries,
        auditLogs: { rows: pagedAudit, total: mergedAudit.length },
        agentActions: agentPartial,
        creations: undefined,
      })
    }

    const creations =
      allow(tables, "creations") && paramStart && paramEnd
        ? await fetchRecentCreations({
            supabase,
            startIso: paramStart,
            endIso: paramEnd,
            limit,
          })
        : undefined

    const [auditRange, agentRange] = await Promise.all([
      allow(tables, "audit_logs")
        ? fetchAuditLogsRange({
            supabase,
            startIso: paramStart ?? undefined,
            endIso: paramEnd ?? undefined,
            actionType,
            actorId: undefined,
            targetIdLike: undefined,
            offset,
            limit,
          })
        : Promise.resolve({ rows: [] as AuditRow[], total: 0 }),
      allow(tables, "agent_actions")
        ? fetchAgentActionsRange({
            supabase,
            startIso: paramStart ?? undefined,
            endIso: paramEnd ?? undefined,
            userId: undefined,
            teamId: undefined,
            offset,
            limit,
          })
        : Promise.resolve({ rows: [], total: 0 }),
    ])

    return NextResponse.json({
      ok: true as const,
      mode: browseDefault ? ("browse" as const) : ("time_window" as const),
      parsed,
      browseWindowApplied: browseDefault,
      entityHits: [],
      auditLogs: auditRange,
      agentActions: agentRange,
      creations,
    })
  } catch (error: unknown) {
    console.error("admin dev-console:", error)
    return NextResponse.json(
      { ok: false as const, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
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
