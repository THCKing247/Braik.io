/** Optional outgoing header so support can correlate client + server logs. */
export const CLIENT_REQUEST_ID_HEADER = "X-Client-Request-Id"

export function createClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function headersWithClientRequestId(initHeaders?: HeadersInit): Headers {
  const h = new Headers(initHeaders)
  if (!h.has(CLIENT_REQUEST_ID_HEADER)) {
    h.set(CLIENT_REQUEST_ID_HEADER, createClientRequestId())
  }
  return h
}

/** Merges init so each request carries a client-generated id unless already provided. */
export function mergeInitWithClientRequestId(
  init?: RequestInit & { timeoutMs?: number }
): RequestInit & { timeoutMs?: number } {
  if (!init) {
    return { headers: headersWithClientRequestId() }
  }
  const { timeoutMs, headers, ...rest } = init
  return {
    ...rest,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    headers: headersWithClientRequestId(headers),
  }
}

export function readResponseRequestId(res: Response): string | null {
  return res.headers.get("x-request-id") ?? res.headers.get("X-Request-Id")
}
