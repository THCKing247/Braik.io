/**
 * Shared types for the admin dev console API (server + client contracts).
 */

export type DevConsoleSearchMode = "global" | "structured" | "trace" | "inspect" | "browse" | "time_window"

export type DevConsoleScopeName =
  | "users"
  | "teams"
  | "subscriptions"
  | "audit_logs"
  | "agent_actions"
  | "creations"
  | "uuid_fragment_rpc"

export type DevConsoleErrorCode =
  | "SCOPE_QUERY_FAILED"
  | "TABLE_UNAVAILABLE"
  | "INVALID_FILTER"
  | "INVALID_DATE_RANGE"
  | "UNSUPPORTED_COMBINATION"
  | "RPC_UNAVAILABLE"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR"

export type FailedScopePayload = {
  scope: DevConsoleScopeName | string
  error_code: DevConsoleErrorCode
  safe_message: string
}

export type DevConsoleWarning = {
  code?: string
  message: string
  scope?: string
}

export type MatchType =
  | "pk_uuid_exact"
  | "fk_uuid_exact"
  | "uuid_partial"
  | "email_exact"
  | "email_partial"
  | "name_exact"
  | "name_partial"
  | "status_exact"
  | "status_partial"
  | "action_type_exact"
  | "action_type_partial"
  | "text_contains"
  | "text_starts_with"
  | "time_window"
  | "related_activity"
  | "browse"
  | "unknown"

export type UnifiedSearchResultRow = {
  source_table: string
  matched_field: string
  match_type: MatchType
  record_id: string
  label: string
  secondary_label?: string | null
  created_at?: string | null
  relevance_score: number
  /** Small preview payload for inspector list views */
  preview?: Record<string, unknown>
}

export type GroupedResults = Record<string, UnifiedSearchResultRow[]>

export type DevConsolePagination = {
  offset: number
  limit: number
  /** Total hits when known (best-effort per mode) */
  total_hint?: number
}

export type DevConsoleQuerySummary = {
  normalized_query: string
  normalized_query_type:
    | "empty"
    | "uuid_full"
    | "uuid_partial"
    | "email"
    | "date_range"
    | "relative_range"
    | "text"
    | "inspect"
  mode: DevConsoleSearchMode
  browse_window_applied?: boolean
}
