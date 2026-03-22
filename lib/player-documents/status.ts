import type { SupabaseClient } from "@supabase/supabase-js"

export type EffectiveDocStatus = "active" | "expired" | "deleted"

export function effectiveDocumentStatus(row: {
  deleted_at?: string | null
  expires_at?: string | null
  status?: string | null
}): EffectiveDocStatus {
  if (row.deleted_at) return "deleted"
  const exp = row.expires_at ? new Date(row.expires_at).getTime() : null
  if (exp !== null && !Number.isNaN(exp) && exp < Date.now()) return "expired"
  const s = (row.status ?? "active").toLowerCase()
  if (s === "deleted") return "deleted"
  if (s === "expired") return "expired"
  return "active"
}

/** Sync DB status column for cron / list consistency (active rows past expires_at → expired). */
export async function syncExpiredStatusInDb(
  supabase: SupabaseClient,
  documentId: string
): Promise<void> {
  const { data: row } = await supabase
    .from("player_documents")
    .select("id, deleted_at, expires_at, status")
    .eq("id", documentId)
    .maybeSingle()

  if (!row || row.deleted_at) return
  const eff = effectiveDocumentStatus(row as { deleted_at: string | null; expires_at: string | null; status: string | null })
  if (eff === "expired" && (row as { status?: string }).status !== "expired") {
    await supabase.from("player_documents").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", documentId)
  }
}
