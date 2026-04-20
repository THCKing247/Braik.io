/**
 * Dev Console — model metadata for the guided query UI (no SQL exposed).
 * Used by schema rail, field pickers, and validation.
 */

export type DevModel = "users" | "teams" | "subscriptions" | "audit_logs" | "agent_actions"

export type FilterOperator = "eq" | "contains" | "starts_with" | "gte" | "lte"

export type FieldSpec = {
  id: string
  label: string
  /** PostgREST / Supabase column name */
  column: string
  type: "uuid" | "text" | "email" | "timestamp" | "enum" | "boolean" | "numeric"
  operators: FilterOperator[]
  indexed?: boolean
  /** Shown in schema rail */
  hint?: string
}

export type ModelCatalogEntry = {
  id: DevModel
  label: string
  description: string
  primaryKey: string
  /** Columns returned by structured browse */
  defaultSelect: string[]
  indexedFields: string[]
  searchableFields: string[]
  bestSearchField: string
  fields: FieldSpec[]
  exampleQueries: string[]
  /** When a table might be missing in some envs */
  optionalTable?: boolean
}

export const DEV_CONSOLE_MODELS: ModelCatalogEntry[] = [
  {
    id: "users",
    label: "Users",
    description: "Platform accounts (login identity, role, status).",
    primaryKey: "id",
    defaultSelect: ["id", "email", "name", "role", "status", "created_at", "last_login_at"],
    indexedFields: ["id", "email", "role", "status", "created_at"],
    searchableFields: ["email", "name", "id"],
    bestSearchField: "email",
    fields: [
      {
        id: "id",
        label: "User id",
        column: "id",
        type: "uuid",
        operators: ["eq"],
        indexed: true,
        hint: "Exact UUID — use Global or Trace search for partial UUID fragments.",
      },
      {
        id: "email",
        label: "Email",
        column: "email",
        type: "email",
        operators: ["eq", "contains", "starts_with"],
        indexed: true,
        hint: "Best for support — partial match is ok.",
      },
      {
        id: "name",
        label: "Name",
        column: "name",
        type: "text",
        operators: ["contains", "starts_with"],
      },
      {
        id: "role",
        label: "Role",
        column: "role",
        type: "text",
        operators: ["eq", "contains"],
      },
      {
        id: "status",
        label: "Status",
        column: "status",
        type: "enum",
        operators: ["eq", "contains", "starts_with"],
      },
      {
        id: "created_at",
        label: "Created at",
        column: "created_at",
        type: "timestamp",
        operators: ["gte", "lte"],
        indexed: true,
      },
    ],
    exampleQueries: [
      "Email contains @school.edu",
      "Created in the last 7 days",
      "Role equals admin",
    ],
  },
  {
    id: "teams",
    label: "Teams",
    description: "Programs / organizations.",
    primaryKey: "id",
    defaultSelect: ["id", "name", "head_coach_user_id", "team_status", "subscription_status", "created_at"],
    indexedFields: ["id", "name", "created_at"],
    searchableFields: ["name", "id", "head_coach_user_id"],
    bestSearchField: "name",
    fields: [
      { id: "id", label: "Team id", column: "id", type: "uuid", operators: ["eq"], indexed: true },
      { id: "name", label: "Name", column: "name", type: "text", operators: ["contains", "starts_with"], indexed: true },
      {
        id: "head_coach_user_id",
        label: "Head coach user id",
        column: "head_coach_user_id",
        type: "uuid",
        operators: ["eq"],
      },
      { id: "team_status", label: "Team status", column: "team_status", type: "text", operators: ["eq"] },
      {
        id: "subscription_status",
        label: "Subscription status",
        column: "subscription_status",
        type: "text",
        operators: ["eq"],
      },
      { id: "created_at", label: "Created at", column: "created_at", type: "timestamp", operators: ["gte", "lte"] },
    ],
    exampleQueries: ["Name contains Tigers", "Trace coach user UUID"],
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    description: "Billing subscription rows (optional in some sandboxes).",
    primaryKey: "id",
    defaultSelect: ["id", "team_id", "status", "stripe_subscription_id", "created_at", "current_period_end"],
    indexedFields: ["id", "team_id", "status"],
    searchableFields: ["team_id", "stripe_subscription_id", "id"],
    bestSearchField: "team_id",
    optionalTable: true,
    fields: [
      { id: "id", label: "Subscription id", column: "id", type: "uuid", operators: ["eq"], indexed: true },
      { id: "team_id", label: "Team id", column: "team_id", type: "uuid", operators: ["eq"], indexed: true },
      { id: "status", label: "Status", column: "status", type: "text", operators: ["eq"] },
      {
        id: "stripe_subscription_id",
        label: "Stripe subscription id",
        column: "stripe_subscription_id",
        type: "text",
        operators: ["eq", "contains"],
      },
      { id: "created_at", label: "Created at", column: "created_at", type: "timestamp", operators: ["gte", "lte"] },
    ],
    exampleQueries: ["Team UUID equals …", "Active subscriptions"],
  },
  {
    id: "audit_logs",
    label: "Audit logs",
    description: "Security and platform audit trail.",
    primaryKey: "id",
    defaultSelect: [
      "id",
      "action_type",
      "actor_id",
      "target_type",
      "target_id",
      "team_id",
      "created_at",
    ],
    indexedFields: ["actor_id", "action_type", "created_at", "team_id"],
    searchableFields: ["action_type", "target_id", "actor_id", "target_type"],
    bestSearchField: "target_id",
    fields: [
      { id: "id", label: "Log id", column: "id", type: "uuid", operators: ["eq"], indexed: true },
      {
        id: "action_type",
        label: "Action type",
        column: "action_type",
        type: "text",
        operators: ["eq", "contains"],
        indexed: true,
        hint: "Indexed with created_at — filter time range for speed.",
      },
      { id: "actor_id", label: "Actor user id", column: "actor_id", type: "uuid", operators: ["eq"], indexed: true },
      { id: "target_type", label: "Target type", column: "target_type", type: "text", operators: ["eq", "contains"] },
      { id: "target_id", label: "Target id", column: "target_id", type: "text", operators: ["contains", "eq"] },
      { id: "team_id", label: "Team id", column: "team_id", type: "uuid", operators: ["eq"] },
      { id: "created_at", label: "Created at", column: "created_at", type: "timestamp", operators: ["gte", "lte"], indexed: true },
    ],
    exampleQueries: ["Target id equals user UUID", "Actions today", "Actor is head coach"],
  },
  {
    id: "agent_actions",
    label: "Agent actions",
    description: "AI agent executions (credits, undo window).",
    primaryKey: "id",
    defaultSelect: ["id", "user_id", "team_id", "action_type", "executed_at", "undone", "cost_in_credits"],
    indexedFields: ["team_id", "user_id", "executed_at"],
    searchableFields: ["user_id", "team_id", "action_type"],
    bestSearchField: "user_id",
    fields: [
      { id: "id", label: "Action id", column: "id", type: "uuid", operators: ["eq"] },
      { id: "user_id", label: "User id", column: "user_id", type: "uuid", operators: ["eq"], indexed: true },
      { id: "team_id", label: "Team id", column: "team_id", type: "uuid", operators: ["eq"], indexed: true },
      { id: "action_type", label: "Action type", column: "action_type", type: "text", operators: ["eq", "contains"] },
      { id: "executed_at", label: "Executed at", column: "executed_at", type: "timestamp", operators: ["gte", "lte"], indexed: true },
      { id: "undone", label: "Undone", column: "undone", type: "boolean", operators: ["eq"] },
    ],
    exampleQueries: ["Team activity last hour", "Actions for user UUID"],
  },
]

const BY_ID = new Map(DEV_CONSOLE_MODELS.map((m) => [m.id, m]))

export function getModelCatalog(id: DevModel): ModelCatalogEntry | undefined {
  return BY_ID.get(id)
}

export function getFieldSpec(model: DevModel, fieldId: string): FieldSpec | undefined {
  return getModelCatalog(model)?.fields.find((f) => f.id === fieldId)
}
