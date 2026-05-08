import { ApiError } from "@/lib/api/core/api-error"
import { fetchJson } from "@/lib/api/core/fetch-json"

/** GET coach Stripe Connect status — nullable when route fails (matches inline `if (res.ok)` loaders). */
export async function fetchCoachPaymentsStatus(teamId: string): Promise<unknown | null> {
  try {
    return await fetchJson(`/api/teams/${encodeURIComponent(teamId)}/payments/coach/status`, {
      credentials: "same-origin",
    })
  } catch (error) {
    if (error instanceof ApiError) return null
    throw error
  }
}

export async function fetchCoachPaymentsCollections(teamId: string): Promise<unknown | null> {
  try {
    return await fetchJson(`/api/teams/${encodeURIComponent(teamId)}/payments/coach/collections`, {
      credentials: "same-origin",
    })
  } catch (error) {
    if (error instanceof ApiError) return null
    throw error
  }
}

export async function postCoachPaymentsConnect(
  teamId: string,
  body: Record<string, unknown>
): Promise<unknown> {
  try {
    return await fetchJson(`/api/teams/${encodeURIComponent(teamId)}/payments/coach/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof ApiError) {
      const message =
        typeof error.body === "object" && error.body && "error" in error.body
          ? (error.body as { error?: string }).error
          : undefined
      throw new Error(message || "Failed to connect account")
    }
    throw error
  }
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
  try {
    await fetchJson(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (error instanceof ApiError) {
      const message =
        typeof error.body === "object" && error.body && "error" in error.body
          ? (error.body as { error?: string }).error
          : undefined
      throw new Error(message || "Failed to save collection")
    }
    throw error
  }
}

export async function deleteCoachPaymentsCollection(teamId: string, collectionId: string): Promise<void> {
  try {
    await fetchJson(
      `/api/teams/${encodeURIComponent(teamId)}/payments/coach/collections/${encodeURIComponent(collectionId)}`,
      {
        method: "DELETE",
        credentials: "same-origin",
      }
    )
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error("Failed to delete collection")
    }
    throw error
  }
}
