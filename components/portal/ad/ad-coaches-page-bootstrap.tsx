"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AdCoachesPageClient } from "@/components/portal/ad/ad-coaches-page-client"
import type {
  AdAssistantCoachAssignmentRow,
  AdCoachAssignmentsPicklistTeam,
  AdHeadCoachAssignmentRow,
} from "@/lib/ad-portal-coach-assignments"
import type { EngagementHint } from "@/lib/engagement/dashboard-hints-data"
import { readLightweightMemoryRaw, writeLightweightMemory } from "@/lib/api-client/lightweight-fetch-memory"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"
import { adPortalClientPerf } from "@/lib/debug/ad-portal-client-perf"

type BootstrapJson = {
  teams: AdCoachAssignmentsPicklistTeam[]
  coaches: {
    headRows: AdHeadCoachAssignmentRow[]
    assistantRows: AdAssistantCoachAssignmentRow[]
  }
  hints: EngagementHint[]
  hintsContextTeamId: string | null
}

const AD_COACHES_MEM_KEY = "lw-mem:ad-coaches-bootstrap"

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
  const memInit = typeof window !== "undefined" ? readLightweightMemoryRaw(AD_COACHES_MEM_KEY) : null
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(() =>
    memInit ? "ready" : "loading"
  )
  const [errorMessage, setErrorMessage] = useState("")
  const [data, setData] = useState<BootstrapJson | null>(() =>
    memInit ? (memInit.value as BootstrapJson) : null
  )
  const [quietRefresh, setQuietRefresh] = useState(false)
  const dataRef = useRef(data)
  dataRef.current = data

  const load = useCallback(() => {
    const had = Boolean(dataRef.current)
    if (had) {
      setQuietRefresh(true)
    } else {
      setPhase("loading")
    }
    setErrorMessage("")
    const t0 = typeof performance !== "undefined" ? performance.now() : 0
    adPortalClientPerf("ad_coaches_bootstrap_fetch_start")
    fetchWithTimeout("/api/ad/bootstrap", { credentials: "same-origin" })
      .then(async (res) => {
        adPortalClientPerf("ad_coaches_bootstrap_fetch_done", {
          ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
          status: res.status,
        })
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          throw new Error(body.error || (res.status === 403 ? "Access denied" : "Failed to load"))
        }
        return body as BootstrapJson
      })
      .then((json) => {
        setData(json)
        writeLightweightMemory(AD_COACHES_MEM_KEY, json)
        setPhase("ready")
        setQuietRefresh(false)
      })
      .catch((e: unknown) => {
        if (had && dataRef.current) {
          setQuietRefresh(false)
          setErrorMessage(e instanceof Error ? e.message : "Could not refresh")
          return
        }
        setErrorMessage(e instanceof Error ? e.message : "Failed to load")
        setPhase("error")
        setQuietRefresh(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (phase === "loading" && !data) {
    return <CoachesSkeleton />
  }

  if (phase === "error" && !data) {
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

  if (!data) {
    return <CoachesSkeleton />
  }

  return (
    <div className="relative space-y-2">
      {quietRefresh ? (
        <p
          className="flex items-center gap-2 text-xs text-[#6B7280]"
          role="status"
          aria-live="polite"
        >
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" />
          Updating coaches…
        </p>
      ) : null}
      {errorMessage && !quietRefresh ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{errorMessage}</p>
      ) : null}
      <AdCoachesPageClient
        headRows={data.coaches.headRows}
        assistantRows={data.coaches.assistantRows}
        teamsPicklist={data.teams}
        hints={data.hints}
        hintsContextTeamId={data.hintsContextTeamId}
        onBootstrapRefetch={load}
      />
    </div>
  )
}
