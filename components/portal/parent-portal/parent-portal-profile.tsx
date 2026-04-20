"use client"

import { useEffect, useState } from "react"
import { Loader2, Shirt } from "lucide-react"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"
import { ParentPortalDocuments } from "@/components/portal/parent-portal/parent-portal-documents"

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

/** Linked athlete snapshot — data is scoped to the roster player; session remains the signed-in parent. */
export function ParentPortalProfile() {
  const { linkedPlayerAccountSegment, teamId } = useParentPortal()
  const [data, setData] = useState<ProfilePayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const url = `/api/roster/${encodeURIComponent(linkedPlayerAccountSegment)}/profile?teamId=${encodeURIComponent(teamId)}`
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
  }, [linkedPlayerAccountSegment, teamId])

  const p = data?.profile
  const displayName =
    [p?.preferredName?.trim(), p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() ||
    [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() ||
    "Athlete profile"

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Athlete snapshot</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-slate-400" aria-hidden />
          </div>
        ) : (
          <>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">{displayName}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <Shirt className="h-3.5 w-3.5" aria-hidden /> Jersey
                </dt>
                <dd className="mt-1 text-lg font-bold text-slate-900">{p?.jerseyNumber ?? "—"}</dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Position</dt>
                <dd className="mt-1 font-semibold text-slate-900">{p?.positionGroup ?? "—"}</dd>
              </div>
              {p?.grade ? (
                <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grade</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{p.grade}</dd>
                </div>
              ) : null}
              {p?.eligibilityStatus ? (
                <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Eligibility</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{p.eligibilityStatus}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-widest text-slate-600">Documents</h2>
        <ParentPortalDocuments />
      </section>
    </div>
  )
}
