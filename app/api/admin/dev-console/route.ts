import { NextResponse } from "next/server"
import { z } from "zod"
import {
  classifyDbError,
  createRequestId,
  devConsoleLog,
  sanitizeClientMessage,
} from "@/lib/admin/dev-console-logging"
import { buildSearchableRegistry } from "@/lib/admin/dev-console-registry"
import { runDevConsoleGet } from "@/lib/admin/dev-console-get"
import {
  runStructuredDevConsoleQuery,
  type FilterGroupNode,
} from "@/lib/admin/dev-console-structured-query"
import { requireAdminRoleForApi } from "@/lib/permissions/platform-permissions"
import {
  normalizeLimit,
  normalizeOffset,
  parseTableFilters,
} from "@/lib/admin/dev-console-query"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export const runtime = "nodejs"

function parseSearchMode(raw: string | null): "global" | "trace" {
  return raw === "trace" ? "trace" : "global"
}

export async function GET(request: Request) {
  const gate = await requireAdminRoleForApi()
  if (!gate.ok) {
    return gate.response
  }

  const requestId = createRequestId()
  const url = new URL(request.url)

  if (url.searchParams.get("registry") === "1") {
    return NextResponse.json({
      ok: true as const,
      request_id: requestId,
      registry: buildSearchableRegistry(),
    })
  }

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

  const searchMode = parseSearchMode(url.searchParams.get("mode"))

  /** Guard bad explicit date range */
  if (paramStart !== undefined && paramStart !== null && paramEnd !== undefined && paramEnd !== null) {
    const a = new Date(paramStart).getTime()
    const b = new Date(paramEnd).getTime()
    if (!Number.isNaN(a) && !Number.isNaN(b) && b < a) {
      return NextResponse.json(
        {
          ok: false as const,
          request_id: requestId,
          error_code: "INVALID_DATE_RANGE" as const,
          safe_message: "End date must be on or after start date.",
        },
        { status: 400 }
      )
    }
  }

  const supabase = getSupabaseServer()

  try {
    const payload = await runDevConsoleGet({
      requestId,
      supabase,
      inspect,
      q,
      actionType,
      tables,
      offset,
      limit,
      urlParamStart: paramStart,
      urlParamEnd: paramEnd,
      searchMode,
    })
    return NextResponse.json(payload)
  } catch (error: unknown) {
    devConsoleLog(requestId, "error", "dev_console_get_fatal", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        ok: false as const,
        request_id: requestId,
        error_code: "INTERNAL_ERROR" as const,
        safe_message: "The dev console could not complete this request.",
      },
      { status: 500 }
    )
  }
}

const filterConditionSchema = z.object({
  kind: z.literal("condition"),
  id: z.string(),
  field: z.string(),
  operator: z.enum(["eq", "contains", "starts_with", "gte", "lte"]),
  value: z.string().max(4000),
})

const filterGroupSchema: z.ZodType<FilterGroupNode> = z.lazy(() =>
  z.object({
    kind: z.literal("group"),
    id: z.string(),
    op: z.enum(["and", "or"]),
    children: z.array(z.union([filterConditionSchema, filterGroupSchema])).max(48),
  })
)

const structuredBodySchema = z.object({
  model: z.enum(["users", "teams", "subscriptions", "audit_logs", "agent_actions"]),
  limit: z.number().int().min(1).max(100),
  offset: z.number().int().min(0),
  dateStart: z.string().nullable().optional(),
  dateEnd: z.string().nullable().optional(),
  root: filterGroupSchema,
})

export async function POST(request: Request) {
  const gate = await requireAdminRoleForApi()
  if (!gate.ok) {
    return gate.response
  }

  const requestId = createRequestId()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false as const, request_id: requestId, error_code: "VALIDATION_FAILED" as const, safe_message: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const parsed = structuredBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false as const,
        request_id: requestId,
        error_code: "VALIDATION_FAILED" as const,
        safe_message: "Validation failed.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()

  try {
    const result = await runStructuredDevConsoleQuery(supabase, parsed.data)
    return NextResponse.json({
      ok: true as const,
      request_id: requestId,
      mode: "structured" as const,
      model: parsed.data.model,
      columns: result.columns,
      rows: result.rows,
      total: result.total,
      humanSummary: result.humanSummary,
      failed_scopes: [] as const,
      warnings: [] as const,
    })
  } catch (error: unknown) {
    const internal = error instanceof Error ? error.message : String(error)
    const safe_message = sanitizeClientMessage(error)
    const error_code = classifyDbError(internal)
    devConsoleLog(requestId, "warn", "structured_query_failed", {
      model: parsed.data.model,
      error_code,
      internal: internal.slice(0, 500),
    })
    return NextResponse.json({
      ok: false as const,
      request_id: requestId,
      error_code,
      safe_message,
    })
  }
}
