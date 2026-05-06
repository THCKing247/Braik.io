"use client"

import { useEffect, useState } from "react"
import { Loader2, Shirt } from "lucide-react"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"
import { ParentPortalDocuments } from "@/components/portal/parent-portal/parent-portal-documents"
import { braikParentTheme } from "@/components/portal/portal-brand-tokens"

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
  const {
    linkedPlayerAccountSegment,
    linkedPlayerFirstName,
    linkedPlayerLastName,
    linkedPlayerPreferredName,
    parentDisplayName,
    parentEmail,
    linkCodeSegment,
    teamId,
  } = useParentPortal()
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
      <section className="rounded-2xl border border-[#1f2f63] bg-[#F8F8F8] p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#081848]">Athlete snapshot</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-slate-400" aria-hidden />
          </div>
        ) : (
          <>
            <h3 className="mt-2 text-2xl font-bold text-[#081838]">{displayName}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[#d7deef] bg-[#F8F8E8] px-4 py-3">
                <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#081848]">
                  <Shirt className="h-3.5 w-3.5" aria-hidden /> Jersey
                </dt>
                <dd className="mt-1 text-lg font-bold text-[#081838]">{p?.jerseyNumber ?? "—"}</dd>
              </div>
              <div className="rounded-xl border border-[#d7deef] bg-[#F8F8E8] px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#081848]">Position</dt>
                <dd className="mt-1 font-semibold text-[#081838]">{p?.positionGroup ?? "—"}</dd>
              </div>
              {p?.grade ? (
                <div className="rounded-xl border border-[#d7deef] bg-white px-4 py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#081848]">Grade</dt>
                  <dd className="mt-1 font-semibold text-[#081838]">{p.grade}</dd>
                </div>
              ) : null}
              {p?.eligibilityStatus ? (
                <div className="rounded-xl border border-[#d7deef] bg-white px-4 py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#081848]">Eligibility</dt>
                  <dd className="mt-1 font-semibold text-[#081838]">{p.eligibilityStatus}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-[#1f2f63] bg-[#F8F8F8] p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#081848]">Parent link</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
          <div className="rounded-xl border border-[#d7deef] bg-[#F8F8E8] px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#081848]">Linked athlete</dt>
            <dd className="mt-1 font-semibold text-[#081838]">
              {[linkedPlayerPreferredName, linkedPlayerFirstName, linkedPlayerLastName].filter(Boolean).join(" ").trim() ||
                "Athlete"}
            </dd>
          </div>
          <div className="rounded-xl border border-[#d7deef] bg-[#F8F8E8] px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#081848]">Parent account</dt>
            <dd className="mt-1 font-semibold text-[#081838]">{parentDisplayName?.trim() || parentEmail || "Parent user"}</dd>
          </div>
          <div className="rounded-xl border border-[#d7deef] bg-[#F8F8E8] px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#081848]">Portal link key</dt>
            <dd className="mt-1 font-mono text-xs font-semibold text-[#081838]">{linkCodeSegment}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className={`mb-3 px-1 text-sm font-bold uppercase tracking-widest ${braikParentTheme.textSecondary}`}>Documents</h2>
        <ParentPortalDocuments />
      </section>
    </div>
  )
}
