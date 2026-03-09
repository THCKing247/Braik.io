"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

/** Session shape passed from dashboard layout (subset we need for logging). */
interface DebugSession {
  user?: {
    id?: string
    role?: string
    teamId?: string | null
  } | null
}

interface CoachPageDebugProps {
  /** Only log when role is coach (HEAD_COACH or ASSISTANT_COACH). */
  session: DebugSession | null
  /** Team IDs the user is a member of (from team_members or profile fallback). */
  teamIds: string[]
  /** Whether the layout allowed access (user passed auth and role check). */
  accessAllowed: boolean
}

/**
 * Temporary debug utility: logs for each coach page request.
 * Remove or gate behind env when no longer needed.
 */
export function CoachPageDebug({ session, teamIds, accessAllowed }: CoachPageDebugProps) {
  const pathname = usePathname()
  const logged = useRef<string | null>(null)

  useEffect(() => {
    const role = session?.user?.role?.toUpperCase()
    const isCoach = role === "HEAD_COACH" || role === "ASSISTANT_COACH"
    if (!isCoach) return

    const key = `${pathname}:${session?.user?.id ?? ""}`
    if (logged.current === key) return
    logged.current = key

    const payload = {
      pathname,
      sessionUserId: session?.user?.id ?? null,
      profileRole: session?.user?.role ?? null,
      profileTeamId: session?.user?.teamId ?? null,
      teamMembershipResult: teamIds.length > 0 ? { count: teamIds.length, teamIds } : null,
      accessAllowed,
      pageDataFetchStatus: "N/A (layout only)",
    }
    // eslint-disable-next-line no-console
    console.log("[CoachPageDebug]", payload)
  }, [pathname, session?.user?.id, session?.user?.role, session?.user?.teamId, teamIds, accessAllowed])

  return null
}
