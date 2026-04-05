/**
 * Per-request memoization for auth + team access (React `cache()`).
 *
 * Use these helpers in Route Handlers and server utilities so a single HTTP request does not
 * repeat `profiles`/`users` reads or membership resolution when multiple steps need the same context.
 *
 * Entry points:
 * - `getRequestAuth()` — same contract as `getRequestUserLite()`, deduped per request
 * - `getResolvedTeamAccessForRequest(teamId)` — session + `resolveTeamAccess` for that team, deduped per (request, teamId)
 */
import { cache } from "react"
import type { RequestUserLiteResult } from "@/lib/auth/server-auth"
import { getRequestUserLite } from "@/lib/auth/server-auth"
import { resolveTeamAccess, type ResolvedTeamAccess } from "@/lib/auth/team-access-resolve"

export const getRequestAuth = cache(async (): Promise<RequestUserLiteResult | null> => {
  return getRequestUserLite()
})

export const getResolvedTeamAccessForRequest = cache(
  async (teamId: string): Promise<ResolvedTeamAccess | null> => {
    const session = await getRequestAuth()
    const userId = session?.user?.id
    if (!userId || !teamId) return null
    return resolveTeamAccess(teamId, userId)
  }
)

export type { RequestUserLiteResult } from "@/lib/auth/server-auth"
export type { ResolvedTeamAccess } from "@/lib/auth/team-access-resolve"
