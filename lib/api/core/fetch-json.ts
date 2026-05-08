import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"
import { ApiError } from "@/lib/api/core/api-error"
import { mergeInitWithClientRequestId, readResponseRequestId } from "@/lib/api/core/request-id"

export type FetchJsonInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit
  /** Passed through to `fetchWithTimeout` (default 28s). */
  timeoutMs?: number
  /**
   * Optional request id override.
   * - `undefined`: auto-generate header
   * - `string`: send that id
   * - `false`: disable client request-id header
   */
  requestId?: string | null | false
}

function parseBodyText(text: string): unknown {
  if (!text.trim()) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function errorMessageFromBody(status: number, parsed: unknown): string {
  if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
    const e = (parsed as { error?: unknown }).error
    if (typeof e === "string" && e.trim()) return e
  }
  return `HTTP ${status}`
}

/**
 * Authenticated JSON fetch: same-origin credentials, timeout, JSON parse, throws {@link ApiError} on non-OK.
 * Adds {@link CLIENT_REQUEST_ID_HEADER} unless already set; surfaces server `X-Request-Id` on errors.
 */
export async function fetchJson<T>(input: RequestInfo | URL, init?: FetchJsonInit): Promise<T> {
  const { requestId: outgoingRequestId, ...restInit } = init ?? {}
  const merged = mergeInitWithClientRequestId(restInit, outgoingRequestId)
  const { timeoutMs, ...rest } = merged
  const res = await fetchWithTimeout(input, {
    ...rest,
    credentials: rest.credentials ?? "same-origin",
    timeoutMs,
  })
  const requestId = readResponseRequestId(res)
  const text = await res.text()
  const parsed = parseBodyText(text)

  if (!res.ok) {
    throw new ApiError(errorMessageFromBody(res.status, parsed), res.status, parsed, requestId)
  }

  return parsed as T
}
