"use client"

import { useEffect, useState } from "react"
import { Loader2, Shirt } from "lucide-react"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { PlayerPortalDocuments } from "@/components/portal/player-portal/player-portal-documents"
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"

type ProfilePayload = {
  profile?: {
    firstName?: string | null
    lastName?: string | null
    preferredName?: string | null
    jerseyNumber?: number | null
    positionGroup?: string | null
    grade?: string | null
    eligibilityStatus?: string | null
  }
}

export function PlayerPortalProfilePage() {
  const { accountSegment, teamId } = usePlayerPortal()
  const [data, setData] = useState<ProfilePayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const url = `/api/roster/${encodeURIComponent(accountSegment)}/profile?teamId=${encodeURIComponent(teamId)}`
    setLoading(true)
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ProfilePayload | null) => {
        if (!cancelled) setData(j)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountSegment, teamId])

  const p = data?.profile
  const displayName =
    [p?.preferredName?.trim(), p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() ||
    [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() ||
    "Your profile"

  return (
    <div className="space-y-6">
      <section className={`rounded-2xl border p-5 shadow-xl ${braikPlayerTheme.surface}`}>
        <h2 className={`text-xs font-bold uppercase tracking-widest ${braikPlayerTheme.accentText}`}>Athlete snapshot</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-[#F85808]" aria-hidden />
          </div>
        ) : (
          <>
            <h3 className={`mt-2 text-2xl font-black ${braikPlayerTheme.textWarm}`}>{displayName}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[#2a3152] bg-[#10265f] px-4 py-3">
                <dt className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${braikPlayerTheme.accentText}`}>
                  <Shirt className="h-3.5 w-3.5" aria-hidden /> Jersey
                </dt>
                <dd className={`mt-1 text-lg font-black ${braikPlayerTheme.textWarm}`}>{p?.jerseyNumber ?? "—"}</dd>
              </div>
              <div className="rounded-xl border border-[#2a3152] bg-[#10265f] px-4 py-3">
                <dt className={`text-[11px] font-bold uppercase tracking-wide ${braikPlayerTheme.textSecondary}`}>Position</dt>
                <dd className={`mt-1 font-bold ${braikPlayerTheme.textWarm}`}>{p?.positionGroup ?? "—"}</dd>
              </div>
              {p?.grade ? (
                <div className="rounded-xl border border-[#2a3152] bg-[#10265f] px-4 py-3">
                  <dt className={`text-[11px] font-bold uppercase tracking-wide ${braikPlayerTheme.textMuted}`}>Grade</dt>
                  <dd className={`mt-1 font-semibold ${braikPlayerTheme.textWarm}`}>{p.grade}</dd>
                </div>
              ) : null}
              {p?.eligibilityStatus ? (
                <div className="rounded-xl border border-[#2a3152] bg-[#10265f] px-4 py-3">
                  <dt className={`text-[11px] font-bold uppercase tracking-wide ${braikPlayerTheme.textMuted}`}>Eligibility</dt>
                  <dd className={`mt-1 font-semibold ${braikPlayerTheme.textWarm}`}>{p.eligibilityStatus}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </section>

      <section>
        <h2 className={`mb-3 px-1 text-sm font-black uppercase tracking-widest ${braikPlayerTheme.textSecondary}`}>Documents</h2>
        <PlayerPortalDocuments />
      </section>
    </div>
  )
}
