"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AdTeamEditForm } from "@/components/portal/ad/ad-team-edit-form"

type OkPayload = {
  kind: "ok"
  teamId: string
  teamName: string
  initialName: string
  initialSport: string
  initialRosterSize: number | null
  initialTeamLevel: string | null
  initialGender: string | null
  initialHeadCoachEmail: string | null
  headCoachDisplay: string | null
  assistantNamesText: string
  seasonDisplay: string
}

export function AdTeamEditPageClient({ teamId }: { teamId: string }) {
  const router = useRouter()
  const params = useParams<{ shortOrgId?: string }>()
  const orgBase = params?.shortOrgId ? `/org/${params.shortOrgId}` : null
  const [data, setData] = useState<OkPayload | null>(null)
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/ad/pages/team-edit?teamId=${encodeURIComponent(teamId)}`,
          { credentials: "include", cache: "no-store" }
        )
        if (res.status === 401) {
          router.replace(
            `/login?callbackUrl=${encodeURIComponent(orgBase ? `${orgBase}/teams/${teamId}` : `/dashboard/ad/teams/${teamId}`)}`
          )
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { redirectTo?: string; data?: OkPayload }
        if (cancelled) return
        if (json.redirectTo) {
          router.replace(json.redirectTo)
          return
        }
        if (json.data?.kind === "ok") {
          setData(json.data)
          setPhase("ready")
        } else {
          setPhase("error")
        }
      } catch {
        if (!cancelled) setPhase("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router, teamId, orgBase])

  if (phase === "error") {
    return <p className="text-[#212529]">Could not load team.</p>
  }
  if (phase !== "ready" || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 rounded bg-[#E5E7EB]" />
        <div className="h-72 rounded-xl bg-[#F3F4F6]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={orgBase ? `${orgBase}/teams` : "/dashboard/ad/teams"}
          className="text-sm font-medium text-[#3B82F6] hover:underline mb-2 inline-block"
        >
          ← Back to teams
        </Link>
        <h1 className="text-2xl font-bold text-[#212529]">Edit team</h1>
        <p className="mt-1 text-[#6B7280]">{data.teamName}</p>
      </div>
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <AdTeamEditForm
          teamId={data.teamId}
          initialName={data.initialName}
          initialSport={data.initialSport}
          initialRosterSize={data.initialRosterSize}
          initialTeamLevel={data.initialTeamLevel}
          initialGender={data.initialGender}
          initialHeadCoachEmail={data.initialHeadCoachEmail}
        />
        <dl className="mt-8 grid gap-2 text-sm border-t border-[#E5E7EB] pt-6">
          <div>
            <dt className="font-medium text-[#6B7280]">Head coach (display)</dt>
            <dd className="text-[#212529]">{data.headCoachDisplay ?? "No head coach assigned"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Assistant coaches</dt>
            <dd className="text-[#212529]">{data.assistantNamesText}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Season</dt>
            <dd className="text-[#212529]">{data.seasonDisplay}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
