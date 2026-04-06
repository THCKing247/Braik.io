/**
 * Detect PostgREST/Postgres errors that indicate a missing table, view, column,
 * or stale schema cache — so API routes can fall back instead of returning 500.
 */
export function isSupabaseSchemaObjectMissingError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  const code = error.code ?? ""

  if (code === "42P01" || code === "42703") return true
  if (code === "PGRST205" || code === "PGRST204") return true

  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("undefined column") ||
    msg.includes("undefined table") ||
    (msg.includes("column") && msg.includes("does not exist"))
  )
}
