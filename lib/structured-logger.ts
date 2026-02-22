/**
 * Structured JSON logger for API routes. Server-safe, no external deps.
 * Safe against unserializable context (try/catch with fallback).
 */

export type LogContext = Record<string, unknown>

function safeStringify(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

/**
 * Log an AI action event (info level). Never throws.
 */
export function logAIAction(action: string, ctx?: LogContext): void {
  try {
    const payload = { level: "info", event: "ai_action", action, ...ctx, ts: new Date().toISOString() }
    console.info(safeStringify(payload))
  } catch {
    console.info(JSON.stringify({ level: "info", event: "ai_action", action, ts: new Date().toISOString(), error: "log_serialization_failed" }))
  }
}

/**
 * Log a permission denial (warn level). Never throws.
 */
export function logPermissionDenial(reason: string, ctx?: LogContext): void {
  try {
    const payload = { level: "warn", event: "permission_denial", reason, ...ctx, ts: new Date().toISOString() }
    console.warn(safeStringify(payload))
  } catch {
    console.warn(JSON.stringify({ level: "warn", event: "permission_denial", reason, ts: new Date().toISOString(), error: "log_serialization_failed" }))
  }
}
