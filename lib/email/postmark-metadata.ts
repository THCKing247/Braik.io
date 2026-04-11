/**
 * Postmark `/email` expects `Metadata` as a flat JSON object of string values
 * (@see https://postmarkapp.com/developer/api/email-api — Metadata: object).
 * Max 10 fields; key names max 20 chars; values max 80 chars (per Postmark docs).
 */

const MAX_KEYS = 10
const MAX_KEY_LEN = 20
const MAX_VALUE_LEN = 80

/**
 * Normalizes caller-supplied metadata into Postmark-safe string values only.
 * Accepts string / number / boolean / null / objects / arrays from callers;
 * outputs only flat string values (numbers and booleans stringified).
 * Objects/arrays → JSON.stringify; null/undefined skipped; functions/symbols skipped.
 */
export function sanitizePostmarkMetadata(
  input?: Record<string, unknown> | null
): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined

  const out: Record<string, string> = {}
  const keys = Object.keys(input).slice(0, MAX_KEYS)

  for (const key of keys) {
    const shortKey = key.slice(0, MAX_KEY_LEN)
    if (!shortKey) continue

    const raw = input[key as keyof typeof input]
    if (raw === null || raw === undefined) continue

    let value: string

    if (typeof raw === "string") {
      value = raw
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      value = String(raw)
    } else if (typeof raw === "boolean") {
      value = raw ? "true" : "false"
    } else if (typeof raw === "object") {
      try {
        value = JSON.stringify(raw)
      } catch {
        value = "[object]"
      }
    } else if (typeof raw === "bigint") {
      value = String(raw)
    } else {
      continue
    }

    out[shortKey] = value.slice(0, MAX_VALUE_LEN)
  }

  if (Object.keys(out).length === 0) return undefined
  return out
}
