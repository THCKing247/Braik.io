"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { AppBootstrapProvider } from "@/components/portal/app-bootstrap-context"

export type PlayerPortalContextValue = {
  accountSegment: string
  teamId: string
  teamName: string
  sport: string
  userId: string
  userName: string | null
  userEmail: string | null
  userRole: "PLAYER"
  /** Resolved roster row id for this team — required for documents/messages APIs */
  playerId: string | null
  playerIdLoading: boolean
}

const PlayerPortalContext = createContext<PlayerPortalContextValue | null>(null)

export function usePlayerPortal(): PlayerPortalContextValue {
  const ctx = useContext(PlayerPortalContext)
  if (!ctx) {
    throw new Error("usePlayerPortal must be used within PlayerPortalProvider")
  }
  return ctx
}

export function PlayerPortalProvider({
  accountSegment,
  teamId,
  teamName,
  sport,
  userId,
  userName,
  userEmail,
  children,
}: {
  accountSegment: string
  teamId: string
  teamName: string
  sport: string
  userId: string
  userName: string | null
  userEmail: string | null
  children: React.ReactNode
}) {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerIdLoading, setPlayerIdLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const tid = teamId.trim()
    if (!tid) {
      setPlayerId(null)
      setPlayerIdLoading(false)
      return
    }
    setPlayerIdLoading(true)
    fetch(`/api/roster/me?teamId=${encodeURIComponent(tid)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { playerId?: string | null } | null) => {
        if (!cancelled) setPlayerId(typeof j?.playerId === "string" ? j.playerId : null)
      })
      .catch(() => {
        if (!cancelled) setPlayerId(null)
      })
      .finally(() => {
        if (!cancelled) setPlayerIdLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  const value = useMemo<PlayerPortalContextValue>(
    () => ({
      accountSegment,
      teamId,
      teamName,
      sport,
      userId,
      userName,
      userEmail,
      userRole: "PLAYER",
      playerId,
      playerIdLoading,
    }),
    [accountSegment, teamId, teamName, sport, userId, userName, userEmail, playerId, playerIdLoading]
  )

  const tid = teamId.trim()
  if (!tid) {
    return (
      <div className="rounded-2xl border border-white/30 bg-white/10 p-6 text-center text-white backdrop-blur">
        <p className="font-medium">No team is linked to your account yet.</p>
      </div>
    )
  }

  return (
    <AppBootstrapProvider teamId={tid}>
      <PlayerPortalContext.Provider value={value}>{children}</PlayerPortalContext.Provider>
    </AppBootstrapProvider>
  )
}
