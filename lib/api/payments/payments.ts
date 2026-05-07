import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

/** GET coach Stripe Connect status — nullable when route fails (matches inline `if (res.ok)` loaders). */
export async function fetchCoachPaymentsStatus(teamId: string): Promise<unknown | null> {
  const res = await fetchWithTimeout(`/api/teams/${encodeURIComponent(teamId)}/payments/coach/status`, {
    credentials: "same-origin",
  })
  if (!res.ok) return null
  return res.json()
}

export async function fetchCoachPaymentsCollections(teamId: string): Promise<unknown | null> {
  const res = await fetchWithTimeout(`/api/teams/${encodeURIComponent(teamId)}/payments/coach/collections`, {
    credentials: "same-origin",
  })
  if (!res.ok) return null
  return res.json()
}

export async function postCoachPaymentsConnect(
  teamId: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const response = await fetchWithTimeout(`/api/teams/${encodeURIComponent(teamId)}/payments/coach/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || "Failed to connect account")
  }
  return data
}

export async function saveCoachPaymentsCollection(
  teamId: string,
  payload: Record<string, unknown>,
  editingId?: string | null
): Promise<void> {
  const url = editingId
    ? `/api/teams/${encodeURIComponent(teamId)}/payments/coach/collections/${encodeURIComponent(editingId)}`
    : `/api/teams/${encodeURIComponent(teamId)}/payments/coach/collections`
  const method = editingId ? "PATCH" : "POST"
  const response = await fetchWithTimeout(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error((error as { error?: string }).error || "Failed to save collection")
  }
}

export async function deleteCoachPaymentsCollection(teamId: string, collectionId: string): Promise<void> {
  const response = await fetchWithTimeout(
    `/api/teams/${encodeURIComponent(teamId)}/payments/coach/collections/${encodeURIComponent(collectionId)}`,
    {
      method: "DELETE",
      credentials: "same-origin",
    }
  )
  if (!response.ok) {
    throw new Error("Failed to delete collection")
  }
}
