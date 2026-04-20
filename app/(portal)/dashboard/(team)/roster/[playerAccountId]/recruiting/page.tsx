"use client"

import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import {
  buildDashboardTeamPlayerPath,
  parseCanonicalDashboardTeamPath,
} from "@/lib/navigation/organization-routes"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

export default function PlayerRecruitingPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <PlayerRecruitingPageContent teamId={teamId} canEdit={canEdit} />
      )}
    </DashboardPageShell>
  )
}

function PlayerRecruitingPageContent({
  teamId,
  canEdit,
}: {
  teamId: string
  canEdit: boolean
}) {
  const params = useParams()
  const pathname = usePathname() ?? ""
  const playerSegment = (params?.playerAccountId as string) ?? ""
  const [report, setReport] = useState<Record<string, unknown> | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const canonicalTeam = parseCanonicalDashboardTeamPath(pathname)
  const backHref =
    canonicalTeam && playerSegment
      ? buildDashboardTeamPlayerPath({ ...canonicalTeam, playerAccountId: playerSegment })
      : `/dashboard/roster/${playerSegment}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`

  const loadReport = async () => {
    if (!playerSegment) return
    setReportLoading(true)
    setReport(null)
    try {
      const q = new URLSearchParams({ playerId: playerSegment })
      if (teamId) q.set("teamId", teamId)
      const res = await fetch(`/api/recruiting/report?${q.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      }
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-[#2563EB] hover:underline">
          ← Back to player
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#212529]">Recruiting</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Public profile, report, and coach tools for this player.
        </p>
      </div>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#111827]">Public recruiting profile</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          When recruiting visibility is on, recruiters can view the profile at the link below.
        </p>
        <div className="mt-4">
          <Link
            href={`/recruiting/${encodeURIComponent(playerSegment)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]"
          >
            View profile (public) →
          </Link>
        </div>
      </section>

      {canEdit && (
        <>
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Recruiting report</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Aggregate player info, team level, promotion history, stats, development, playbook mastery, coach notes, video links, and recruiter interest.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadReport}
                disabled={reportLoading}
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {reportLoading ? "Loading…" : "Generate report"}
              </button>
              {report && (
                <a
                  href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`}
                  download={`recruiting-report-${playerSegment}.json`}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F3F4F6]"
                >
                  Download JSON
                </a>
              )}
            </div>
            {report && (
              <pre className="mt-4 max-h-[400px] overflow-auto rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-xs text-[#374151]">
                {JSON.stringify(report, null, 2)}
              </pre>
            )}
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Coach actions</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Use the APIs to update recruiting profile, video links, and log recruiter interest: POST /api/recruiting/profile/coach, /api/recruiting/video-links, /api/recruiting/interest.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
