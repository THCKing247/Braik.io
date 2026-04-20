import type { SupabaseClient } from "@supabase/supabase-js"
import type { DevModel, FilterOperator } from "@/lib/admin/dev-console-schema"
import { getFieldSpec, getModelCatalog } from "@/lib/admin/dev-console-schema"

/** Condition leaf */
export type FilterConditionNode = {
  kind: "condition"
  id: string
  field: string
  operator: FilterOperator
  value: string
}

/** Group; root should be `{ kind: 'group', op: 'and', ... }`. OR groups may only contain conditions. */
export type FilterGroupNode = {
  kind: "group"
  id: string
  op: "and" | "or"
  children: Array<FilterConditionNode | FilterGroupNode>
}

export type StructuredDevConsoleRequest = {
  model: DevModel
  limit: number
  offset: number
  /** Applied to created_at / executed_at when model has that column */
  dateStart?: string | null
  dateEnd?: string | null
  root: FilterGroupNode
}

function sanitizeIlike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_")
}

function conditionToOrFragment(c: FilterConditionNode, model: DevModel): string {
  const spec = getFieldSpec(model, c.field)
  if (!spec) throw new Error(`Unknown field: ${c.field}`)
  const col = spec.column
  const v = c.value.trim()
  switch (c.operator) {
    case "eq":
      if (spec.type === "uuid") return `${col}.eq.${v}`
      if (spec.type === "boolean") return `${col}.eq.${v === "true" || v === "1" ? "true" : "false"}`
      return `${col}.eq.${v}`
    case "contains":
      return `${col}.ilike.*${sanitizeIlike(v)}*`
    case "starts_with":
      return `${col}.ilike.${sanitizeIlike(v)}*`
    case "gte":
      return `${col}.gte.${v}`
    case "lte":
      return `${col}.lte.${v}`
    default:
      throw new Error(`Unsupported operator ${c.operator}`)
  }
}

function applyCondition(qb: any, c: FilterConditionNode, model: DevModel): any {
  const spec = getFieldSpec(model, c.field)
  if (!spec) throw new Error(`Unknown field: ${c.field}`)
  const col = spec.column
  const v = c.value.trim()

  let q = qb
  switch (c.operator) {
    case "eq":
      if (spec.type === "boolean") {
        return q.eq(col, v === "true" || v === "1")
      }
      return q.eq(col, v)
    case "contains":
      return q.ilike(col, `%${sanitizeIlike(v)}%`)
    case "starts_with":
      return q.ilike(col, `${sanitizeIlike(v)}%`)
    case "gte":
      return q.gte(col, v)
    case "lte":
      return q.lte(col, v)
    default:
      throw new Error(`Unsupported operator ${c.operator}`)
  }
}

function applyGroup(qb: any, node: FilterGroupNode, model: DevModel, depth: number): any {
  if (depth > 6) throw new Error("Filter nesting too deep")

  if (node.op === "or") {
    const conds = node.children.filter((c): c is FilterConditionNode => c.kind === "condition")
    if (conds.length === 0) return qb
    const frag = conds.map((c) => conditionToOrFragment(c, model)).join(",")
    return qb.or(frag)
  }

  let q = qb
  for (const child of node.children) {
    if (child.kind === "condition") {
      q = applyCondition(q, child, model)
    } else {
      q = applyGroup(q, child as FilterGroupNode, model, depth + 1)
    }
  }
  return q
}

function dateColumnForModel(model: DevModel): string | null {
  if (model === "agent_actions") return "executed_at"
  return "created_at"
}

export async function runStructuredDevConsoleQuery(
  supabase: SupabaseClient,
  input: StructuredDevConsoleRequest
): Promise<{
  rows: Record<string, unknown>[]
  total: number
  columns: string[]
  humanSummary: string
}> {
  const catalog = getModelCatalog(input.model)
  if (!catalog) throw new Error("Unknown model")

  const selectList = catalog.defaultSelect.join(", ")
  let q = supabase.from(input.model).select(selectList, { count: "exact" })

  if (input.root.children.length > 0) {
    q = applyGroup(q, input.root, input.model, 0)
  }

  const dc = dateColumnForModel(input.model)
  if (dc) {
    if (input.dateStart) q = q.gte(dc, input.dateStart)
    if (input.dateEnd) q = q.lte(dc, input.dateEnd)
  }

  const sortCol = dc ?? catalog.primaryKey
  q = q.order(sortCol, { ascending: false })

  const lim = Math.min(Math.max(1, input.limit), 100)
  const off = Math.max(0, input.offset)
  const { data: rows, error, count } = await q.range(off, off + lim - 1)

  if (error) {
    const msg = error.message?.toLowerCase() ?? ""
    if (msg.includes("does not exist") || msg.includes("relation")) {
      throw new Error(
        `Table "${input.model}" is not available in this environment. Try another model or contact platform.`
      )
    }
    throw error
  }

  const columns = catalog.defaultSelect
  const humanSummary = buildStructuredHumanSummary(input)

  return {
    rows: (rows ?? []) as unknown as Record<string, unknown>[],
    total: count ?? rows?.length ?? 0,
    columns,
    humanSummary,
  }
}

function buildStructuredHumanSummary(input: StructuredDevConsoleRequest): string {
  const catalog = getModelCatalog(input.model)
  const modelLabel = catalog?.label ?? input.model
  const parts: string[] = [`Showing ${modelLabel}`]

  const walk = (g: FilterGroupNode): string[] => {
    const out: string[] = []
    for (const ch of g.children) {
      if (ch.kind === "condition") {
        const spec = getFieldSpec(input.model, ch.field)
        const label = spec?.label ?? ch.field
        out.push(`${label} ${humanOp(ch.operator)} “${ch.value}”`)
      } else {
        const inner = walk(ch as FilterGroupNode)
        out.push(`(${inner.join(` ${(ch as FilterGroupNode).op.toUpperCase()} `)})`)
      }
    }
    return out
  }

  if (input.root.children.length) {
    parts.push(`where ${walk(input.root).join(" AND ")}`)
  }

  if (input.dateStart || input.dateEnd) {
    parts.push(
      `between ${input.dateStart ?? "…"} and ${input.dateEnd ?? "…"} (row time column)`
    )
  }

  parts.push(`— up to ${input.limit} rows`)
  return parts.join(" ")
}

function humanOp(op: FilterOperator): string {
  switch (op) {
    case "eq":
      return "is"
    case "contains":
      return "contains"
    case "starts_with":
      return "starts with"
    case "gte":
      return "≥"
    case "lte":
      return "≤"
    default:
      return op
  }
}

export function emptyFilterRoot(): FilterGroupNode {
  return { kind: "group", id: "root", op: "and", children: [] }
}

export function newConditionRow(model: DevModel): FilterConditionNode {
  const catalog = getModelCatalog(model)
  const first = catalog?.fields[0]
  const rid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `c-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  return {
    kind: "condition",
    id: rid,
    field: first?.id ?? "id",
    operator: first?.operators[0] ?? "eq",
    value: "",
  }
}
