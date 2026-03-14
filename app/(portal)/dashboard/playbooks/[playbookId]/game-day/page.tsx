"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useMemo } from "react"
import { ArrowLeft, Star } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import {
  GAMEDAY_FILTERS,
  getGamedayFavorites,
  toggleGamedayFavorite,
  playMatchesFilter,
  type GamedayFilterId,
} from "@/lib/constants/gameday-filters"
import type { PlaybookRecord, PlayRecord } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"
import { PlayCardThumbnail } from "@/components/portal/play-card-thumbnail"
import { getPlayFormationDisplayName } from "@/lib/utils/playbook-formation"
import type { FormationRecord } from "@/types/playbook"

export default function GameDayPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null

  const [playbook, setPlaybook] = useState<PlaybookRecord | null>(null)
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [formations, setFormations] = useState<FormationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<GamedayFilterId | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const [selectedPlay, setSelectedPlay] = useState<PlayRecord | null>(null)

  const load = useCallback(async () => {
    if (!playbookId) return
    setLoading(true)
    try {
      const pbRes = await fetch(`/api/playbooks/${playbookId}`)
      const pb = pbRes.ok ? await pbRes.json() : null
      if (pb) setPlaybook(pb)
      const teamId = pb?.teamId
      const [pRes, fRes] = await Promise.all([
        fetch(`/api/plays?playbookId=${playbookId}${teamId ? `&teamId=${teamId}` : ""}`),
        teamId ? fetch(`/api/formations?teamId=${teamId}&playbookId=${playbookId}`) : Promise.resolve(null),
      ])
      if (pRes?.ok) {
        const data = await pRes.json()
        setPlays(Array.isArray(data) ? data : data.plays ?? [])
      }
      if (fRes?.ok) {
        const data = await fRes.json()
        setFormations(Array.isArray(data) ? data : data.formations ?? [])
      }
      setFavorites(getGamedayFavorites(playbookId))
    } catch (e) {
      console.error("Failed to load game day", e)
    } finally {
      setLoading(false)
    }
  }, [playbookId])

  useEffect(() => {
    load()
  }, [load])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  const filteredPlays = useMemo(() => {
    if (!activeFilter) return plays
    return plays.filter((p) => playMatchesFilter(p, activeFilter, favoriteSet))
  }, [plays, activeFilter, favoriteSet])

  const handleToggleFavorite = useCallback(
    (playId: string) => {
      if (!playbookId) return
      const nowFav = toggleGamedayFavorite(playbookId, playId)
      setFavorites((prev) => (nowFav ? [...prev, playId] : prev.filter((id) => id !== playId)))
    },
    [playbookId]
  )

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: playbook?.name ?? "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
    { label: "Game day" },
  ]

  if (!playbookId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid playbook</p>}
      </DashboardPageShell>
    )
  }

  if (loading) {
    return (
      <DashboardPageShell>
        {() => (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        )}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {() => (
        <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
            <PlaybookBreadcrumbs items={breadcrumbs} className="mb-2" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Game day</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/playbooks/${playbookId}`)}
                className="touch-manipulation"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
            <p className="text-sm text-slate-600 mt-1">Tap a play to view. Large, touch-friendly.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {GAMEDAY_FILTERS.map((f) => (
                <Button
                  key={f.id}
                  variant={activeFilter === f.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter(activeFilter === f.id ? null : f.id)}
                  className="touch-manipulation min-h-[44px] min-w-[80px] text-sm"
                >
                  {f.id === "favorite" && <Star className={`h-4 w-4 mr-1 ${activeFilter === f.id ? "fill-current" : ""}`} />}
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPlays.map((play) => (
                <div
                  key={play.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlay(play)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedPlay(play)}
                  className="rounded-xl border-2 border-slate-200 bg-white p-3 cursor-pointer hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition-all touch-manipulation min-h-[120px] flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate text-base">{play.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {getPlayFormationDisplayName(play, formations)}
                        {play.subFormation ? ` · ${play.subFormation}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleFavorite(play.id)
                      }}
                      className="p-2 rounded-full text-slate-400 hover:text-amber-500 touch-manipulation flex-shrink-0"
                      aria-label={favoriteSet.has(play.id) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star className={`h-5 w-5 ${favoriteSet.has(play.id) ? "fill-amber-400 text-amber-500" : ""}`} />
                    </button>
                  </div>
                  <div className="mt-2 w-full aspect-[200/140] max-h-24 rounded-lg overflow-hidden bg-[#2d5016] flex-shrink-0">
                    <PlayCardThumbnail
                      canvasData={play.canvasData as PlayCanvasData | null}
                      className="w-full h-full"
                    />
                  </div>
                  {(play.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(play.tags ?? []).slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {filteredPlays.length === 0 && (
              <div className="py-12 text-center text-slate-500">
                <p className="font-medium">No plays match this filter.</p>
                <p className="text-sm mt-1">Try another filter or add plays to your playbook.</p>
              </div>
            )}
          </div>

          {/* Focused presentation modal */}
          {selectedPlay && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
              onClick={() => setSelectedPlay(null)}
              role="presentation"
            >
              <div
                className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Play detail"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{selectedPlay.name}</h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {getPlayFormationDisplayName(selectedPlay, formations)}
                      {selectedPlay.subFormation ? ` · ${selectedPlay.subFormation}` : ""}
                    </p>
                    {(selectedPlay.tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(selectedPlay.tags ?? []).map((tag) => (
                          <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPlay(null)} className="shrink-0">
                    Close
                  </Button>
                </div>
                <div className="w-full aspect-[4/3] max-h-[50vh] rounded-xl overflow-hidden bg-[#2d5016]">
                  <PlayCardThumbnail
                    canvasData={selectedPlay.canvasData as PlayCanvasData | null}
                    className="w-full h-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardPageShell>
  )
}
