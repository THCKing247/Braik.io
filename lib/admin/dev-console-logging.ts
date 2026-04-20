import type { DevConsoleErrorCode } from "@/lib/admin/dev-console-types"

export function createRequestId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `req-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  }
}

export function devConsoleLog(
  requestId: string,
  level: "info" | "warn" | "error",
  message: string,
  detail?: Record<string, unknown>
): void {
  const payload = { requestId, ...detail }
  if (level === "error") {
    console.error(`[dev-console] ${message}`, payload)
  } else if (level === "warn") {
    console.warn(`[dev-console] ${message}`, payload)
  } else {
    console.log(`[dev-console] ${message}`, payload)
  }
}

export function sanitizeClientMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    const m = (err as { message: string }).message
    const lower = m.toLowerCase()
    if (lower.includes("jwt") || lower.includes("password") || lower.includes("secret")) {
      return "Database request failed."
    }
    return m.length > 240 ? `${m.slice(0, 237)}…` : m
  }
  return "Request failed."
}

export function classifyDbError(msg: string): DevConsoleErrorCode {
  const m = msg.toLowerCase()
  if (m.includes("does not exist") || m.includes("relation") || m.includes("undefined table")) {
    return "TABLE_UNAVAILABLE"
  }
  if (m.includes("invalid input syntax") || m.includes("invalid uuid")) {
    return "INVALID_FILTER"
  }
  if (m.includes("operator") && m.includes("uuid")) {
    return "UNSUPPORTED_COMBINATION"
  }
  return "SCOPE_QUERY_FAILED"
}
