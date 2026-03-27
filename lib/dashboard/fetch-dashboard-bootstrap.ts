import type { DashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"

/** Coalesce concurrent bootstrap requests (Strict Mode double mount, fast remounts). */
const inflight = new Map<string, Promise<DashboardBootstrapPayload | null>>()

export async function fetchDashboardBootstrap(teamId: string): Promise<DashboardBootstrapPayload | null> {
  const key = teamId.trim()
  if (!key) return null
  const existing = inflight.get(key)
  if (existing) return existing

  const p = (async () => {
    const res = await fetch(`/api/dashboard/bootstrap?teamId=${encodeURIComponent(key)}`, {
      credentials: "same-origin",
    })
    if (!res.ok) return null
    return (await res.json()) as DashboardBootstrapPayload
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, p)
  return p
}
