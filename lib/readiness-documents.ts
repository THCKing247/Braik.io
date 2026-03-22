/** Participation docs that count toward readiness (not deleted, not past expires_at). */
export function activeDocumentCategoriesForReadiness(
  rows: Array<{
    category?: string | null
    document_type?: string | null
    deleted_at?: string | null
    expires_at?: string | null
  }>
): string[] {
  const out: string[] = []
  const now = Date.now()
  for (const d of rows) {
    if (d.deleted_at) continue
    if (d.expires_at) {
      const t = new Date(d.expires_at).getTime()
      if (!Number.isNaN(t) && t < now) continue
    }
    const c = String(d.document_type || d.category || "other")
      .trim()
      .toLowerCase()
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}
