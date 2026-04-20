/**
 * Server-authoritative searchable field registry for the dev console.
 * Mirrors `dev-console-schema` catalog with explicit search/ranking hints.
 */

import type { DevModel } from "@/lib/admin/dev-console-schema"
import { DEV_CONSOLE_MODELS } from "@/lib/admin/dev-console-schema"

export type RegistryFieldRole =
  | "pk"
  | "exact_id"
  | "partial_id"
  | "email"
  | "text"
  | "status"
  | "action_type"
  | "timestamp"
  | "fk_user"
  | "fk_team"

export type RegistryOperatorLabel = {
  code: string
  label: string
}

export type SearchableRegistryField = {
  id: string
  column: string
  label: string
  roles: RegistryFieldRole[]
  /** PostgREST / structured operators */
  operators: string[]
  operator_labels: RegistryOperatorLabel[]
}

export type SearchableRegistryModel = {
  id: DevModel
  label: string
  primary_key: string
  display_label_field: string
  default_sort_field: string
  optional_table?: boolean
  searchable_exact_id_fields: string[]
  searchable_partial_id_fields: string[]
  searchable_text_fields: string[]
  date_fields: string[]
  fields: SearchableRegistryField[]
}

const OP_LABELS: RegistryOperatorLabel[] = [
  { code: "eq", label: "equals" },
  { code: "contains", label: "contains" },
  { code: "starts_with", label: "starts with" },
  { code: "gte", label: "on or after" },
  { code: "lte", label: "on or before" },
]

function rolesFor(column: string, type: string, hint?: RegistryFieldRole[]): RegistryFieldRole[] {
  if (hint?.length) return hint
  if (column === "id") return ["pk", "exact_id"]
  if (column.includes("email")) return ["email", "text"]
  if (column.endsWith("_id") || column === "actor_id" || column === "target_id" || column === "user_id") {
    return ["exact_id", "partial_id", "fk_user", "fk_team"].filter(Boolean) as RegistryFieldRole[]
  }
  if (column === "status" || column.endsWith("_status")) return ["status", "text"]
  if (column === "action_type") return ["action_type", "text"]
  if (type === "timestamp") return ["timestamp"]
  return ["text"]
}

export function buildSearchableRegistry(): SearchableRegistryModel[] {
  return DEV_CONSOLE_MODELS.map((m) => {
    const searchable_exact_id_fields: string[] = []
    const searchable_partial_id_fields: string[] = []
    const searchable_text_fields: string[] = []
    const date_fields: string[] = []

    const fields: SearchableRegistryField[] = m.fields.map((f) => {
      const column = f.column
      const kind = f.type

      if (kind === "uuid") {
        searchable_exact_id_fields.push(column)
        if (f.id === "id") searchable_partial_id_fields.push(column)
      }
      if (kind === "email" || column.includes("email")) searchable_text_fields.push(column)
      if (kind === "timestamp") date_fields.push(column)
      if (kind === "text" || kind === "enum" || kind === "email") {
        searchable_text_fields.push(column)
      }

      return {
        id: f.id,
        column,
        label: f.label,
        roles: rolesFor(column, kind, column === "id" && kind === "uuid" ? ["pk", "exact_id", "partial_id"] : undefined),
        operators: f.operators,
        operator_labels: f.operators.map((c) => OP_LABELS.find((o) => o.code === c) ?? { code: c, label: c }),
      }
    })

    return {
      id: m.id,
      label: m.label,
      primary_key: m.primaryKey,
      display_label_field: m.bestSearchField,
      default_sort_field: m.defaultSelect.includes("created_at")
        ? "created_at"
        : m.defaultSelect.includes("executed_at")
          ? "executed_at"
          : m.primaryKey,
      optional_table: m.optionalTable,
      searchable_exact_id_fields: [...new Set(searchable_exact_id_fields)],
      searchable_partial_id_fields: [...new Set(searchable_partial_id_fields)],
      searchable_text_fields: [...new Set(searchable_text_fields)],
      date_fields: [...new Set(date_fields)],
      fields,
    }
  })
}
