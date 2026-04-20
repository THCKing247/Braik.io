"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { TeamRouteShortIds } from "@/lib/portal/dashboard-path"

export type ShellTeamRef = {
  id: string
  shortOrgId?: string | null
  shortTeamId?: string | null
}

/**
 * Minimal team scope from the dashboard shell (server-resolved). Use for URL/session team alignment only.
 * Do not treat as roster or program payload — fetch those on the page that needs them.
 */
export type PortalTeamContextValue = {
  teamIds: string[]
  currentTeamId: string
  /** Short org/team route params for the current team when resolvable (canonical coach URLs). */
  currentTeamRouteIds: TeamRouteShortIds | null
}

const PortalTeamContext = createContext<PortalTeamContextValue | null>(null)

export function usePortalTeam() {
  return useContext(PortalTeamContext)
}

/**
 * Resolves the effective team id for dashboard pages: URL param (if valid), else
 * server-resolved current team, else session team (if valid), else current again.
 * Call from a component that has useSearchParams() and pass the URL teamId.
 */
export function useEffectiveTeamId(
  urlTeamId: string | null,
  sessionTeamId: string | undefined
): string {
  const portal = usePortalTeam()

  return useMemo(() => {
    const valid = new Set(portal?.teamIds ?? [])
    const current = portal?.currentTeamId ?? ""

    if (urlTeamId && valid.has(urlTeamId)) return urlTeamId
    if (current) return current
    if (sessionTeamId && valid.has(sessionTeamId)) return sessionTeamId
    return current
  }, [portal?.teamIds, portal?.currentTeamId, urlTeamId, sessionTeamId])
}

export function PortalTeamProvider({
  teams,
  currentTeamId,
  children,
}: {
  teams: ShellTeamRef[]
  currentTeamId: string
  children: ReactNode
}) {
  const value = useMemo((): PortalTeamContextValue => {
    const teamIds = teams.map((t) => t.id)
    const t = teams.find((x) => x.id === currentTeamId)
    const currentTeamRouteIds: TeamRouteShortIds | null =
      t?.shortOrgId && t?.shortTeamId
        ? { shortOrgId: t.shortOrgId, shortTeamId: t.shortTeamId }
        : null
    return { teamIds, currentTeamId, currentTeamRouteIds }
  }, [teams, currentTeamId])
  return <PortalTeamContext.Provider value={value}>{children}</PortalTeamContext.Provider>
}
