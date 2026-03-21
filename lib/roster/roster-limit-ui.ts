/**
 * Client-side helpers for roster slot enforcement (HTTP 402 + code ROSTER_LIMIT_REACHED).
 * Server messages remain authoritative.
 */

export const ROSTER_LIMIT_EXTRA_HINT =
  "Inactive players do not count toward your roster limit. You can deactivate a player to free a slot, or purchase more slots when billing checkout is enabled for your program."

export function parseRosterLimitResponse(data: unknown): {
  isRosterLimit: boolean
  message: string
  limit?: number
  current?: number
} {
  if (!data || typeof data !== "object") {
    return { isRosterLimit: false, message: "Something went wrong. Please try again." }
  }
  const d = data as Record<string, unknown>
  if (d.code === "ROSTER_LIMIT_REACHED") {
    const base = typeof d.error === "string" ? d.error : "Your roster limit has been reached."
    const limit = typeof d.limit === "number" ? d.limit : undefined
    const current = typeof d.current === "number" ? d.current : undefined
    return {
      isRosterLimit: true,
      message: `${base}\n\n${ROSTER_LIMIT_EXTRA_HINT}`,
      limit,
      current,
    }
  }
  return {
    isRosterLimit: false,
    message: typeof d.error === "string" ? d.error : "Request failed",
  }
}
