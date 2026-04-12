export const SIGNUP_ERROR_CODES = {
  ROSTER_FULL: "ROSTER_FULL",
  INVALID_INVITE_CODE: "INVALID_INVITE_CODE",
  INVITE_EXPIRED: "INVITE_EXPIRED",
  INVITE_MAX_USES: "INVITE_MAX_USES",
  PLAYER_ALREADY_LINKED: "PLAYER_ALREADY_LINKED",
  PARENT_ALREADY_LINKED: "PARENT_ALREADY_LINKED",
  DATABASE_FAILURE: "DATABASE_FAILURE",
} as const

export type SignupErrorCode = (typeof SIGNUP_ERROR_CODES)[keyof typeof SIGNUP_ERROR_CODES]

/** User-facing copy for roster cap on player self-signup (matches product tone). */
export const PLAYER_SIGNUP_ROSTER_FULL_MESSAGE =
  "This team roster is full and is no longer accepting player signups. Please contact your coach if you need help."

export class SignupRouteError extends Error {
  status: number
  details?: string
  code?: SignupErrorCode

  constructor(
    status: number,
    message: string,
    detailsOrOpts?: string | { details?: string; code?: SignupErrorCode }
  ) {
    super(message)
    this.status = status
    if (typeof detailsOrOpts === "string") {
      this.details = detailsOrOpts
    } else if (detailsOrOpts) {
      this.details = detailsOrOpts.details
      this.code = detailsOrOpts.code
    }
  }
}

/** Parse Postgres trigger / Supabase error from players insert/update (BRAIK_ROSTER_FULL). */
export function parseRosterFullFromSupabaseError(err: { message?: string; code?: string; details?: string } | null | undefined): {
  isRosterFull: boolean
  limit?: number
  current?: number
} {
  if (!err) return { isRosterFull: false }
  const msg = err.message ?? ""
  if (msg.includes("BRAIK_ROSTER_FULL") || err.code === "P0001") {
    const raw = err.details
    if (raw && raw.startsWith("{")) {
      try {
        const j = JSON.parse(raw) as { limit?: number; current?: number }
        return { isRosterFull: true, limit: j.limit, current: j.current }
      } catch {
        /* ignore */
      }
    }
    return { isRosterFull: true }
  }
  return { isRosterFull: false }
}
