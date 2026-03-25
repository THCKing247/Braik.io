"use client"

import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { PlaycallerView } from "@/components/portal/playcaller-view"
import type { FormationRecord, PlayRecord } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"

export default function PlayPresenterPage() {
  const params = useParams()
  const router = useRouter()
  const playId = typeof params?.playId === "string" ? params.playId : null

  const [play, setPlay] = useState<PlayRecord | null>(null)
  const [formations, setFormations] = useState<FormationRecord[]>([])
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlay = useCallback(async (id: string) => {
    const res = await fetch(`/api/plays/${id}`, { credentials: "same-origin" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = typeof data?.error === "string" ? data.error : res.status === 404 ? "Play not found" : "Failed to load play"
      throw new Error(message)
    }
    setPlay(data)
    return data.teamId
  }, [])

  const fetchFormations = useCallback(async (teamId: string) => {
    const res = await fetch(`/api/formations?teamId=${teamId}`)
    if (res.ok) {
      const data = await res.json()
      setFormations(data)
    }
  }, [])

  const fetchDepthChart = useCallback(async (teamId: string) => {
    const res = await fetch(`/api/roster/depth-chart?teamId=${teamId}`, { credentials: "same-origin" })
    if (res.ok) {
      const data = await res.json()
      setDepthChartEntries(data.entries ?? [])
    }
  }, [])

  useEffect(() => {
    if (!playId) {
      setError("Missing play ID")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetchPlay(playId)
      .then((teamId) => Promise.all([fetchFormations(teamId), fetchDepthChart(teamId)]))
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load play")
        setLoading(false)
      })
  }, [playId, fetchPlay, fetchFormations, fetchDepthChart])

  const handleClose = useCallback(() => {
    router.push(`/dashboard/playbooks/play/${playId}`)
  }, [router, playId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh] bg-slate-50">
        <p className="text-sm text-slate-500">Loading play...</p>
      </div>
    )
  }

  if (error || !play) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] bg-slate-50 p-6">
        <p className="text-sm text-slate-700">{error ?? "Play not found"}</p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/playbooks")}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Back to playbooks
        </button>
      </div>
    )
  }

  return (
    <PlaycallerView
      plays={[play]}
      currentIndex={0}
      onClose={handleClose}
      onIndexChange={() => {}}
      formations={formations}
      depthChartEntries={depthChartEntries}
    />
  )
}
