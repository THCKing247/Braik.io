"use client"

import { useEffect, useState } from "react"
import { Loader2, Shirt } from "lucide-react"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { PlayerPortalDocuments } from "@/components/portal/player-portal/player-portal-documents"

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
      <section className="rounded-2xl border border-white/40 bg-white p-5 shadow-xl">
        <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Athlete snapshot</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" aria-hidden />
          </div>
        ) : (
          <>
            <h3 className="mt-2 text-2xl font-black text-slate-900">{displayName}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 px-4 py-3">
                <dt className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                  <Shirt className="h-3.5 w-3.5" aria-hidden /> Jersey
                </dt>
                <dd className="mt-1 text-lg font-black text-slate-900">{p?.jerseyNumber ?? "—"}</dd>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Position</dt>
                <dd className="mt-1 font-bold text-slate-900">{p?.positionGroup ?? "—"}</dd>
              </div>
              {p?.grade ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Grade</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{p.grade}</dd>
                </div>
              ) : null}
              {p?.eligibilityStatus ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Eligibility</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{p.eligibilityStatus}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 px-1 text-sm font-black uppercase tracking-widest text-white/90">Documents</h2>
        <PlayerPortalDocuments />
      </section>
    </div>
  )
}
