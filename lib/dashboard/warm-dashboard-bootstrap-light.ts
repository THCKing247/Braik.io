import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

const warming = new Map<string, Promise<void>>()

/**
 * Warms CDN/origin cache for bootstrap-light (safe GET, idempotent). Use from AD portal hover / focus.
 */
export function warmDashboardBootstrapLight(teamId: string): void {
  const t = teamId.trim()
  if (!t || typeof window === "undefined") return
  if (warming.has(t)) return
  const p = fetchWithTimeout(`/api/dashboard/bootstrap-light?teamId=${encodeURIComponent(t)}`, {
    credentials: "same-origin",
  })
    .then(() => {})
    .catch(() => {})
    .finally(() => {
      warming.delete(t)
    })
  warming.set(t, p)
}
