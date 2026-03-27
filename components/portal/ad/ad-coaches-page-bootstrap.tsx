"use client"

import { useCallback, useEffect, useState } from "react"
import { AdCoachesPageClient } from "@/components/portal/ad/ad-coaches-page-client"
import type {
  AdAssistantCoachAssignmentRow,
  AdCoachAssignmentsPicklistTeam,
  AdHeadCoachAssignmentRow,
} from "@/lib/ad-portal-coach-assignments"
import type { EngagementHint } from "@/lib/engagement/dashboard-hints-data"

type BootstrapJson = {
  teams: AdCoachAssignmentsPicklistTeam[]
  coaches: {
    headRows: AdHeadCoachAssignmentRow[]
    assistantRows: AdAssistantCoachAssignmentRow[]
  }
  hints: EngagementHint[]
  hintsContextTeamId: string | null
}

function CoachesSkeleton() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Loading coaches">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-[#E5E7EB]" />
          <div className="h-4 w-full max-w-xl rounded bg-[#F3F4F6]" />
        </div>
        <div className="h-10 w-36 rounded bg-[#E5E7EB]" />
      </div>
      <div className="space-y-3">
        <div className="h-6 w-56 rounded bg-[#E5E7EB]" />
        <div className="h-64 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]" />
      </div>
      <div className="space-y-3">
        <div className="h-6 w-64 rounded bg-[#E5E7EB]" />
        <div className="h-48 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]" />
      </div>
    </div>
  )
}

export function AdCoachesPageBootstrap() {
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const [data, setData] = useState<BootstrapJson | null>(null)

  const load = useCallback(() => {
    setPhase("loading")
    setErrorMessage("")
    fetch("/api/ad/bootstrap", { credentials: "same-origin" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          throw new Error(body.error || (res.status === 403 ? "Access denied" : "Failed to load"))
        }
        return body as BootstrapJson
      })
      .then((json) => {
        setData(json)
        setPhase("ready")
      })
      .catch((e: unknown) => {
        setErrorMessage(e instanceof Error ? e.message : "Failed to load")
        setPhase("error")
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (phase === "loading") {
    return <CoachesSkeleton />
  }

  if (phase === "error" || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-medium">Could not load coaches</p>
        <p className="mt-1">{errorMessage || "Something went wrong."}</p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          onClick={() => load()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <AdCoachesPageClient
      headRows={data.coaches.headRows}
      assistantRows={data.coaches.assistantRows}
      teamsPicklist={data.teams}
      hints={data.hints}
      hintsContextTeamId={data.hintsContextTeamId}
      onBootstrapRefetch={load}
    />
  )
}
