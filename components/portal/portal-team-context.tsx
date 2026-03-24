"use client"

import { createContext, useContext, useMemo } from "react"

/**
 * Minimal team scope from the dashboard shell (server-resolved). Use for URL/session team alignment only.
 * Do not treat as roster or program payload — fetch those on the page that needs them.
 */
export type PortalTeamContextValue = {
  teamIds: string[]
  currentTeamId: string
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
  teamIds,
  currentTeamId,
  children,
}: {
  teamIds: string[]
  currentTeamId: string
  children: React.ReactNode
}) {
  const value = useMemo(
    () => ({ teamIds, currentTeamId }),
    [teamIds, currentTeamId]
  )
  return (
    <PortalTeamContext.Provider value={value}>
      {children}
    </PortalTeamContext.Provider>
  )
}
