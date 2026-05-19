import { NextResponse } from "next/server"
import { CLIENT_REQUEST_ID_HEADER } from "@/lib/api/core/request-id"
import { braikPerfServerEnabled } from "@/lib/perf/braik-perf-config"

const REQUEST_ID_HEADER = "x-request-id"

const SENSITIVE_QUERY_KEYS = new Set([
  "password",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "secret",
  "api_key",
  "apikey",
])

/** Dev API request logging: development default, or `BRAIK_API_LOG=1`. */
export function shouldLogApiDev(): boolean {
  if (typeof process === "undefined") return false
  if (process.env.BRAIK_API_LOG === "0") return false
  if (process.env.BRAIK_API_LOG === "1") return true
  return braikPerfServerEnabled()
}

export function resolveApiRequestId(request: Request): string {
  const fromClient = request.headers.get(CLIENT_REQUEST_ID_HEADER)?.trim()
  if (fromClient) return fromClient
  const fromServer = request.headers.get(REQUEST_ID_HEADER)?.trim()
  if (fromServer) return fromServer
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Redact sensitive query keys; never log full Authorization or Cookie headers. */
export function sanitizeSearchParamsForLog(url: URL): string {
  const out = new URLSearchParams()
  url.searchParams.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (SENSITIVE_QUERY_KEYS.has(lower)) {
      out.set(key, "[redacted]")
      return
    }
    out.set(key, value)
  })
  const s = out.toString()
  return s ? `?${s}` : ""
}

export type ApiDevLogMeta = {
  route: string
  method: string
  status: number
  durationMs: number
  requestId: string
  search?: string
}

export function logApiDevRequest(meta: ApiDevLogMeta): void {
  if (!shouldLogApiDev()) return
  const search = meta.search ?? ""
  console.info(
    `[braik-api] ${meta.method} ${meta.route}${search} ${meta.status} ${meta.durationMs}ms id=${meta.requestId}`
  )
}

export function attachApiRequestId(response: NextResponse, requestId: string): NextResponse {
  if (!response.headers.has(REQUEST_ID_HEADER)) {
    response.headers.set(REQUEST_ID_HEADER, requestId)
  }
  return response
}

/**
 * Wrap a route handler with dev timing logs + `x-request-id` on the response.
 * Does not alter JSON bodies or auth behavior.
 */
export function withApiDevLogging<TContext>(
  routeLabel: string,
  handler: (request: Request, context: TContext) => Promise<NextResponse>
): (request: Request, context: TContext) => Promise<NextResponse> {
  return async (request: Request, context: TContext) => {
    const started = performance.now()
    const requestId = resolveApiRequestId(request)
    const url = new URL(request.url)
    const search = sanitizeSearchParamsForLog(url)
    try {
      const response = await handler(request, context)
      logApiDevRequest({
        route: routeLabel,
        method: request.method,
        status: response.status,
        durationMs: Math.round(performance.now() - started),
        requestId,
        search,
      })
      return attachApiRequestId(response, requestId)
    } catch (error) {
      logApiDevRequest({
        route: routeLabel,
        method: request.method,
        status: 500,
        durationMs: Math.round(performance.now() - started),
        requestId,
        search,
      })
      throw error
    }
  }
}
