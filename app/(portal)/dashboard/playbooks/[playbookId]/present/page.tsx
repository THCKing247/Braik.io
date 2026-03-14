"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ChevronLeft, ChevronRight, Star, Maximize2, Minimize2, Columns } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaycallerView } from "@/components/portal/playcaller-view"
import { PlayCardThumbnail } from "@/components/portal/play-card-thumbnail"
import type { FormationRecord, PlayRecord, SubFormationRecord } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"
import type { PlaybookRecord } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"
import { getGamedayFavorites, toggleGamedayFavorite } from "@/lib/constants/gameday-filters"

type InstallScriptData = { id: string; name: string; items: { playId: string; orderIndex: number }[] }

function PlaybookPresenterContent({
  playbookId,
  teamId,
  scriptId,
}: {
  playbookId: string
  teamId: string
  scriptId: string | null
}) {
  const router = useRouter()
  const [playbook, setPlaybook] = useState<PlaybookRecord | null>(null)
  const [installScript, setInstallScript] = useState<InstallScriptData | null>(null)
  const [formations, setFormations] = useState<FormationRecord[]>([])
  const [subFormations, setSubFormations] = useState<SubFormationRecord[]>([])
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formationId, setFormationId] = useState<string | null>(null)
  const [subFormationId, setSubFormationId] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [playIndex, setPlayIndex] = useState(0)
  const [compareMode, setCompareMode] = useState(false)
  const [playAIndex, setPlayAIndex] = useState(0)
  const [playBIndex, setPlayBIndex] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenContainerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!playbookId || !teamId) return
    setLoading(true)
    setError(null)
    try {
      const [pbRes, fRes, pRes, sfRes, dcRes, ...scriptRes] = await Promise.all([
        fetch(`/api/playbooks/${playbookId}`),
        fetch(`/api/formations?teamId=${teamId}&playbookId=${playbookId}`),
        fetch(`/api/plays?teamId=${teamId}&playbookId=${playbookId}`),
        fetch(`/api/sub-formations?teamId=${teamId}`),
        fetch(`/api/roster/depth-chart?teamId=${teamId}`, { credentials: "same-origin" }),
        ...(scriptId ? [fetch(`/api/install-scripts/${scriptId}`)] : []),
      ])
      if (!pbRes.ok) {
        setError("Playbook not found")
        setLoading(false)
        return
      }
      setPlaybook(await pbRes.json())
      setFavorites(getGamedayFavorites(playbookId))
      if (fRes.ok) setFormations(await fRes.json())
      if (pRes.ok) setPlays(await pRes.json())
      if (sfRes.ok) setSubFormations(await sfRes.json())
      if (dcRes.ok) {
        const dc = await dcRes.json()
        setDepthChartEntries(dc.entries ?? [])
      }
      if (scriptId && scriptRes[0] && "ok" in scriptRes[0] && (scriptRes[0] as Response).ok) {
        const data = await (scriptRes[0] as Response).json()
        setInstallScript({ id: data.id, name: data.name, items: data.items ?? [] })
      } else {
        setInstallScript(null)
      }
    } catch (e) {
      setError("Failed to load playbook")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [playbookId, teamId, scriptId])

  useEffect(() => {
    load()
  }, [load])

  const subFormationsForFormation = useMemo(() => {
    if (!formationId) return []
    return subFormations.filter((s) => s.formationId === formationId)
  }, [formationId, subFormations])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  const playById = useMemo(() => {
    const map = new Map<string, PlayRecord>()
    plays.forEach((p) => map.set(p.id, p))
    return map
  }, [plays])

  const filteredPlays = useMemo(() => {
    if (installScript?.items?.length) {
      const ordered = installScript.items
        .map((item) => playById.get(item.playId))
        .filter((p): p is PlayRecord => p != null)
      return ordered
    }
    let list = plays
    if (subFormationId) {
      list = list.filter((p) => p.subFormationId === subFormationId)
    } else if (formationId) {
      list = list.filter((p) => p.formationId === formationId)
    }
    if (favoritesOnly) {
      list = list.filter((p) => favoriteSet.has(p.id))
    }
    return list.sort((a, b) => {
      const aOrder = a.orderIndex ?? 9999
      const bOrder = b.orderIndex ?? 9999
      if (aOrder !== bOrder) return aOrder - bOrder
      return (a.name || "").localeCompare(b.name || "")
    })
  }, [plays, formationId, subFormationId, favoritesOnly, favoriteSet, installScript, playById])

  const handleToggleFavorite = useCallback(
    (playId: string) => {
      if (!playbookId) return
      const nowFav = toggleGamedayFavorite(playbookId, playId)
      setFavorites((prev) => (nowFav ? [...prev, playId] : prev.filter((id) => id !== playId)))
    },
    [playbookId]
  )

  const currentPlay = filteredPlays[playIndex] ?? null
  const safePlayIndex = Math.min(playIndex, Math.max(0, filteredPlays.length - 1))

  useEffect(() => {
    if (!installScript) setPlayIndex(0)
  }, [formationId, subFormationId, favoritesOnly, installScript])

  useEffect(() => {
    if (installScript) setPlayIndex(0)
  }, [installScript?.id])

  useEffect(() => {
    if (filteredPlays.length > 0 && playIndex >= filteredPlays.length) {
      setPlayIndex(filteredPlays.length - 1)
    }
  }, [filteredPlays.length, playIndex])

  useEffect(() => {
    const maxIdx = Math.max(0, filteredPlays.length - 1)
    setPlayAIndex((i) => Math.min(i, maxIdx))
    setPlayBIndex((i) => Math.min(i, maxIdx))
  }, [filteredPlays.length])

  const handleCompareToggle = useCallback(() => {
    setCompareMode((on) => {
      if (!on) {
        const idx = Math.min(playIndex, Math.max(0, filteredPlays.length - 1))
        const nextB = idx < filteredPlays.length - 1 ? idx + 1 : Math.max(0, idx - 1)
        setPlayAIndex(idx)
        setPlayBIndex(nextB)
      }
      return !on
    })
  }, [playIndex, filteredPlays.length])

  const handleCompareIndexChange = useCallback(
    (delta: number) => {
      const maxIdx = Math.max(0, filteredPlays.length - 1)
      setPlayAIndex((i) => Math.max(0, Math.min(maxIdx, i + delta)))
      setPlayBIndex((i) => Math.max(0, Math.min(maxIdx, i + delta)))
    },
    [filteredPlays.length]
  )

  const safePlayAIndex = Math.min(playAIndex, Math.max(0, filteredPlays.length - 1))
  const safePlayBIndex = Math.min(playBIndex, Math.max(0, filteredPlays.length - 1))

  const handleClose = useCallback(() => {
    router.push(playbookId ? `/dashboard/playbooks/${playbookId}` : "/dashboard/playbooks")
  }, [router, playbookId])

  const handleIndexChange = useCallback((index: number) => {
    setPlayIndex(Math.max(0, Math.min(filteredPlays.length - 1, index)))
  }, [filteredPlays.length])

  const selectedItemRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [safePlayIndex])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  const handleFullscreenToggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (fullscreenContainerRef.current) {
        await fullscreenContainerRef.current.requestFullscreen()
      }
    } catch {
      // ignore (e.g. user cancelled or fullscreen not allowed)
    }
  }, [])

  useEffect(() => {
    const isFormField = (el: EventTarget | null) => {
      if (!el || !(el instanceof HTMLElement)) return false
      const tag = el.tagName.toLowerCase()
      const role = el.getAttribute?.("role")
      return (
        tag === "input" ||
        tag === "select" ||
        tag === "textarea" ||
        el.isContentEditable ||
        role === "combobox" ||
        role === "listbox"
      )
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isFormField(e.target)) return

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault()
          if (compareMode) handleCompareIndexChange(1)
          else handleIndexChange(Math.min(safePlayIndex + 1, filteredPlays.length - 1))
          break
        case "ArrowLeft":
          e.preventDefault()
          if (compareMode) handleCompareIndexChange(-1)
          else handleIndexChange(Math.max(safePlayIndex - 1, 0))
          break
        case "f":
        case "F":
          e.preventDefault()
          handleFullscreenToggle()
          break
        case "Escape":
          if (document.fullscreenElement) {
            e.preventDefault()
            document.exitFullscreen().catch(() => {})
          }
          break
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          e.preventDefault()
          const idx = parseInt(e.key, 10) - 1
          if (idx < filteredPlays.length) handleIndexChange(idx)
          break
        }
        default:
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [safePlayIndex, filteredPlays.length, handleIndexChange, handleCompareIndexChange, compareMode, handleFullscreenToggle])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-slate-50">
        <p className="text-sm text-slate-500">Loading playbook...</p>
      </div>
    )
  }

  if (error || !playbook) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50 p-6">
        <p className="text-sm text-slate-700">{error ?? "Playbook not found"}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/playbooks")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to playbooks
        </Button>
      </div>
    )
  }

  const isScriptMode = !!scriptId

  if (filteredPlays.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <div className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-3 flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleClose}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-sm font-medium text-slate-700">
            {playbook.name} · {isScriptMode ? installScript?.name ?? "Script" : "Presenter"}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <p className="text-slate-600 font-medium">No plays in this selection</p>
          <p className="text-sm text-slate-500 mt-1">
            {isScriptMode
              ? "This install script has no plays. Add plays from the install script page."
              : formationId || subFormationId
                ? "Try changing the formation or sub-formation filter."
                : "This playbook has no plays yet."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={fullscreenContainerRef}
      className={`flex flex-col bg-slate-50 ${isFullscreen ? "h-full w-full" : "h-screen"}`}
    >
      <div
        className={`flex-shrink-0 flex items-center gap-3 flex-wrap ${
          isFullscreen
            ? "border-b border-slate-700/80 bg-slate-900/95 px-3 py-2"
            : "border-b border-slate-200 bg-white px-4 py-3"
        }`}
      >
        {!isFullscreen && (
          <Button variant="outline" size="sm" onClick={handleClose}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}
        {isScriptMode && (
          <span className={`text-sm font-medium ${isFullscreen ? "text-slate-300" : "text-slate-700"}`}>
            {installScript?.name ?? "Install script"}
          </span>
        )}
        {!isScriptMode && (
          <>
            <select
              value={formationId ?? ""}
              onChange={(e) => {
                setFormationId(e.target.value || null)
                setSubFormationId(null)
              }}
              className={`text-sm min-w-[120px] ${isFullscreen ? "h-8 appearance-none border-0 bg-transparent bg-none px-1 text-slate-300 focus:ring-0 [&>option]:bg-slate-800" : "h-8 rounded-md border border-slate-300 bg-white px-2"}`}
              title="Formation"
            >
              <option value="">All formations</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              value={subFormationId ?? ""}
              onChange={(e) => setSubFormationId(e.target.value || null)}
              className={`text-sm min-w-[120px] ${isFullscreen ? "h-8 appearance-none border-0 bg-transparent px-1 text-slate-300 focus:ring-0 [&>option]:bg-slate-800" : "h-8 rounded-md border border-slate-300 bg-white px-2"}`}
              title="Sub-formation"
              disabled={!formationId || subFormationsForFormation.length === 0}
            >
              <option value="">All sub-formations</option>
              {subFormationsForFormation.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </>
        )}
        <div className={`flex items-center gap-1 ${isFullscreen ? "py-0" : "rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1"}`}>
          <Button
            variant="ghost"
            size="icon"
            className={`text-slate-400 hover:text-white ${isFullscreen ? "h-8 w-8" : "h-7 w-7"}`}
            onClick={() => (compareMode ? handleCompareIndexChange(-1) : handleIndexChange(safePlayIndex - 1))}
            disabled={compareMode ? safePlayAIndex <= 0 : safePlayIndex <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className={`font-medium tabular-nums min-w-[72px] text-center ${isFullscreen ? "text-sm text-slate-400" : "text-sm text-slate-700"}`}>
            {compareMode ? `${safePlayAIndex + 1} / ${safePlayBIndex + 1}` : `${safePlayIndex + 1} of ${filteredPlays.length}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className={`text-slate-400 hover:text-white ${isFullscreen ? "h-8 w-8" : "h-7 w-7"}`}
            onClick={() => (compareMode ? handleCompareIndexChange(1) : handleIndexChange(safePlayIndex + 1))}
            disabled={compareMode ? safePlayBIndex >= filteredPlays.length - 1 : safePlayIndex >= filteredPlays.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {compareMode ? (
          <>
            <label className={`text-sm font-medium ${isFullscreen ? "text-slate-400" : "text-slate-600"}`}>
              Play A:
            </label>
            <select
              value={filteredPlays[safePlayAIndex]?.id ?? ""}
              onChange={(e) => {
                const idx = filteredPlays.findIndex((p) => p.id === e.target.value)
                if (idx >= 0) setPlayAIndex(idx)
              }}
              className={`text-sm min-w-[140px] max-w-[200px] ${isFullscreen ? "h-8 appearance-none border-0 bg-transparent px-1 text-slate-200 focus:ring-0 [&>option]:bg-slate-800" : "h-8 rounded-md border border-slate-300 bg-white px-2"}`}
              title="Select Play A"
            >
              {filteredPlays.map((p, i) => (
                <option key={p.id} value={p.id}>
                  {p.name || `Play ${i + 1}`}
                </option>
              ))}
            </select>
            <label className={`text-sm font-medium ${isFullscreen ? "text-slate-400" : "text-slate-600"}`}>
              Play B:
            </label>
            <select
              value={filteredPlays[safePlayBIndex]?.id ?? ""}
              onChange={(e) => {
                const idx = filteredPlays.findIndex((p) => p.id === e.target.value)
                if (idx >= 0) setPlayBIndex(idx)
              }}
              className={`text-sm min-w-[140px] max-w-[200px] ${isFullscreen ? "h-8 appearance-none border-0 bg-transparent px-1 text-slate-200 focus:ring-0 [&>option]:bg-slate-800" : "h-8 rounded-md border border-slate-300 bg-white px-2"}`}
              title="Select Play B"
            >
              {filteredPlays.map((p, i) => (
                <option key={p.id} value={p.id}>
                  {p.name || `Play ${i + 1}`}
                </option>
              ))}
            </select>
          </>
        ) : (
          <select
            value={currentPlay?.id ?? ""}
            onChange={(e) => {
              const idx = filteredPlays.findIndex((p) => p.id === e.target.value)
              if (idx >= 0) setPlayIndex(idx)
            }}
            className={`text-sm min-w-[160px] max-w-[220px] ${isFullscreen ? "h-8 appearance-none border-0 bg-transparent px-1 text-slate-200 focus:ring-0 [&>option]:bg-slate-800" : "h-8 rounded-md border border-slate-300 bg-white px-2"}`}
            title="Play"
          >
            {filteredPlays.map((p, i) => (
              <option key={p.id} value={p.id}>
                {p.name || `Play ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        {!isFullscreen && (
          <button
            type="button"
            onClick={handleCompareToggle}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-sm font-medium transition-colors ${
              compareMode
                ? "border-slate-500 bg-slate-200 text-slate-800"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title={compareMode ? "Exit compare mode" : "Compare two plays side-by-side"}
            aria-pressed={compareMode}
          >
            <Columns className="h-4 w-4 shrink-0" />
            <span>Compare plays</span>
          </button>
        )}
        {!isFullscreen && !isScriptMode && (
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-sm font-medium transition-colors ${
              favoritesOnly
                ? "border-slate-400 bg-slate-100 text-slate-800"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title={favoritesOnly ? "Show all plays" : "Show favorites only"}
            aria-pressed={favoritesOnly}
          >
            <Star className={`h-4 w-4 shrink-0 ${favoritesOnly ? "fill-amber-500 text-amber-500" : "text-slate-400"}`} />
            <span>Favorites</span>
          </button>
        )}
        <Button
          variant={isFullscreen ? "ghost" : "outline"}
          size="icon"
          className={`shrink-0 text-slate-400 hover:text-white ${isFullscreen ? "h-8 w-8" : "h-8 w-8"}`}
          onClick={handleFullscreenToggle}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex-1 min-h-0 flex">
        {compareMode ? (
          <div className="flex-1 min-h-0 flex min-w-0">
            <div className="flex-1 min-h-0 min-w-0 relative border-r border-slate-200">
              <PlaycallerView
                plays={filteredPlays}
                currentIndex={safePlayAIndex}
                onClose={handleClose}
                onIndexChange={(i) => setPlayAIndex(i)}
                formations={formations}
                depthChartEntries={depthChartEntries}
                embedded
                fullscreen={false}
              />
            </div>
            <div className="flex-1 min-h-0 min-w-0 relative">
              <PlaycallerView
                plays={filteredPlays}
                currentIndex={safePlayBIndex}
                onClose={handleClose}
                onIndexChange={(i) => setPlayBIndex(i)}
                formations={formations}
                depthChartEntries={depthChartEntries}
                embedded
                fullscreen={false}
              />
            </div>
          </div>
        ) : (
        <div className="flex-1 min-h-0 relative">
          <PlaycallerView
            plays={filteredPlays}
            currentIndex={safePlayIndex}
            onClose={handleClose}
            onIndexChange={handleIndexChange}
            formations={formations}
            depthChartEntries={depthChartEntries}
            embedded
            fullscreen={isFullscreen}
          />
        </div>
        )}
        {!compareMode && (
        <aside
          className={`flex-shrink-0 flex flex-col min-h-0 ${isFullscreen ? "w-[260px] min-w-[240px] border-l border-slate-700/60 bg-slate-900/80" : "w-[220px] min-w-[200px] border-l border-slate-200 bg-white"}`}
          aria-label="Play list"
        >
          {!isFullscreen && (
            <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Plays ({filteredPlays.length})
              </p>
            </div>
          )}
          {isFullscreen && (
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-slate-700/60">
              <p className="text-xs text-slate-500 tabular-nums">{filteredPlays.length} plays</p>
            </div>
          )}
          <ul className="flex-1 overflow-y-auto overscroll-contain py-1 min-h-0" role="list">
            {filteredPlays.map((play, idx) => {
              const isSelected = idx === safePlayIndex
              const isFav = favoriteSet.has(play.id)
              return (
                <li key={play.id} className="list-none">
                  <div
                    className={`flex items-start w-full rounded-none border-l-2 transition-colors ${
                      isFullscreen
                        ? isSelected
                          ? "bg-slate-700/80 border-slate-400"
                          : "border-transparent hover:bg-slate-800/60"
                        : isSelected
                          ? "bg-slate-100 border-slate-600"
                          : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <button
                      ref={isSelected ? selectedItemRef : undefined}
                      type="button"
                      onClick={() => handleIndexChange(idx)}
                      className="flex-1 flex items-start gap-2 px-3 py-2 text-left min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-inset rounded-none"
                      aria-current={isSelected ? "true" : undefined}
                      aria-label={play.name ? `Switch to ${play.name}` : `Switch to play ${idx + 1}`}
                    >
                      <span className="flex-shrink-0 w-16 rounded overflow-hidden bg-slate-200 ring-1 ring-slate-200">
                        <PlayCardThumbnail
                          canvasData={(play.canvasData ?? null) as PlayCanvasData | null}
                          className="rounded"
                        />
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5 py-0.5">
                        <span className={`font-medium truncate ${isFullscreen ? "text-base" : "text-sm"} ${
                          isFullscreen ? (isSelected ? "text-white" : "text-slate-300 hover:text-white") : (isSelected ? "text-slate-900" : "text-slate-700 hover:text-slate-900")
                        }`}>
                          {play.name || `Play ${idx + 1}`}
                        </span>
                        {(play.formation || play.subFormation) && (
                          <span className={`truncate ${isFullscreen ? "text-sm text-slate-400" : "text-xs text-slate-500"}`}>
                            {[play.formation, play.subFormation].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        {play.tags && play.tags.length > 0 && (
                          <span className="flex flex-wrap gap-1">
                            {play.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="inline-block max-w-[72px] truncate rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-200/80 text-slate-600"
                                title={tag}
                              >
                                {tag}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(play.id)}
                      className={`flex-shrink-0 p-1.5 rounded touch-manipulation self-center ${
                        isFav ? "text-amber-500 hover:text-amber-600" : isFullscreen ? "text-slate-500 hover:text-slate-400" : "text-slate-400 hover:text-slate-600"
                      }`}
                      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star className={`h-4 w-4 ${isFav ? "fill-amber-500" : ""}`} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </aside>
        )}
      </div>
    </div>
  )
}

export default function PlaybookPresenterPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const scriptId = searchParams?.get("scriptId") ?? null

  if (!playbookId) {
    return (
      <DashboardPageShell>
        {() => (
          <div className="flex items-center justify-center min-h-[60vh] bg-slate-50">
            <p className="text-sm text-slate-500">Invalid playbook</p>
          </div>
        )}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ teamId }) => (
        <PlaybookPresenterContent playbookId={playbookId} teamId={teamId} scriptId={scriptId} />
      )}
    </DashboardPageShell>
  )
}
