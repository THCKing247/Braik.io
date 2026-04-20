"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { AppBootstrapProvider } from "@/components/portal/app-bootstrap-context"
import type { ParentPortalContextPayload } from "@/app/api/parent/portal-context/route"
import { DashboardShellLoadingSkeleton } from "@/components/portal/dashboard-shell-loading-skeleton"

export type ParentPortalContextValue = {
  /** URL segment (`player_account_id`–style link key) */
  linkCodeSegment: string
  teamId: string
  teamName: string
  sport: string | null
  parentUserId: string
  /** Signed-in adult from shell profile */
  parentDisplayName: string | null
  parentEmail: string | null
  userRole: "PARENT"
  /** Linked athlete roster id for this team — document APIs resolve access from this player, not impersonation */
  linkedPlayerId: string
  /** Canonical roster URL segment for shared roster/profile APIs */
  linkedPlayerAccountSegment: string
  linkedPlayerFirstName: string | null
  linkedPlayerLastName: string | null
  linkedPlayerPreferredName: string | null
}

const ParentPortalContext = createContext<ParentPortalContextValue | null>(null)

export function useParentPortal(): ParentPortalContextValue {
  const ctx = useContext(ParentPortalContext)
  if (!ctx) {
    throw new Error("useParentPortal must be used within ParentPortalProvider")
  }
  return ctx
}

export function ParentPortalProvider({
  linkCodeSegment,
  shellParentDisplayName,
  shellParentEmail,
  children,
}: {
  linkCodeSegment: string
  shellParentDisplayName: string | null
  shellParentEmail: string | null
  children: React.ReactNode
}) {
  const [payload, setPayload] = useState<ParentPortalContextPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const seg = linkCodeSegment.trim()
    if (!seg) {
      setPayload(null)
      setError("Missing link")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/parent/portal-context?linkCode=${encodeURIComponent(seg)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(typeof j?.error === "string" ? j.error : "Could not load family portal")
        }
        return j as ParentPortalContextPayload
      })
      .then((data) => {
        if (!cancelled) setPayload(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setPayload(null)
          setError(e instanceof Error ? e.message : "Could not load family portal")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [linkCodeSegment])

  const value = useMemo<ParentPortalContextValue | null>(() => {
    if (!payload) return null
    return {
      linkCodeSegment,
      teamId: payload.teamId,
      teamName: payload.teamName,
      sport: payload.sport,
      parentUserId: payload.parentUserId,
      parentDisplayName: shellParentDisplayName,
      parentEmail: shellParentEmail,
      userRole: "PARENT",
      linkedPlayerId: payload.playerId,
      linkedPlayerAccountSegment: payload.playerAccountSegment,
      linkedPlayerFirstName: payload.playerFirstName,
      linkedPlayerLastName: payload.playerLastName,
      linkedPlayerPreferredName: payload.playerPreferredName,
    }
  }, [linkCodeSegment, payload, shellParentDisplayName, shellParentEmail])

  if (loading) {
    return <DashboardShellLoadingSkeleton />
  }

  if (error || !value) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
        <p className="font-semibold text-slate-900">Family portal unavailable</p>
        <p className="mt-2 text-sm text-slate-600">{error ?? "Try again later."}</p>
      </div>
    )
  }

  const tid = value.teamId.trim()
  if (!tid) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="font-medium text-slate-800">No team context for this link.</p>
      </div>
    )
  }

  return (
    <AppBootstrapProvider teamId={tid}>
      <ParentPortalContext.Provider value={value}>{children}</ParentPortalContext.Provider>
    </AppBootstrapProvider>
  )
}
