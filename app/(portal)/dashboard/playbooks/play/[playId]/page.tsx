"use client"

import { useParams, useRouter } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { Play, Pause, RotateCcw, SkipBack, ChevronsLeft, ChevronsRight, Repeat, Route, Film } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlaybookBuilder, type CanvasData } from "@/components/portal/playbook-builder"
import { PlaybookInspector, type InspectorSelectedPlayer } from "@/components/portal/playbook-inspector"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { usePlayAnimation, SPEED_OPTIONS, type PlaybackSpeed } from "@/lib/hooks/use-play-animation"
import type { FormationRecord, PlayRecord, RoutePoint, BlockEndPoint } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"

function PlayEditorContent() {
  const params = useParams()
  const router = useRouter()
  const playId = typeof params?.playId === "string" ? params.playId : null

  const [play, setPlay] = useState<PlayRecord | null>(null)
  const [formations, setFormations] = useState<FormationRecord[]>([])
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [rosterPlayers, setRosterPlayers] = useState<Array<{ id: string; firstName: string; lastName: string; jerseyNumber: number | null; positionGroup: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingPlayType, setEditingPlayType] = useState<PlayRecord["playType"]>(null)
  const [inspectorSelection, setInspectorSelection] = useState<"play" | "player" | "zone" | "route" | null>(null)
  const [selectedPlayerInspector, setSelectedPlayerInspector] = useState<InspectorSelectedPlayer | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [showRoutesInPreview, setShowRoutesInPreview] = useState(true)

  const {
    progress: animationProgress,
    isPlaying: isAnimationPlaying,
    speed: animationSpeed,
    setSpeed: setAnimationSpeed,
    play: animationPlay,
    pause: animationPause,
    restart: animationRestart,
    stepToStart: animationStepToStart,
    stepForward: animationStepForward,
    stepBackward: animationStepBackward,
    loop: animationLoop,
    setLoop: setAnimationLoop,
  } = usePlayAnimation()

  useEffect(() => {
    if (!previewMode) animationStepToStart()
  }, [previewMode, animationStepToStart])

  const teamId = play?.teamId ?? ""

  const fetchPlay = useCallback(async (id: string) => {
    const res = await fetch(`/api/plays/${id}`, { credentials: "same-origin" })
    if (!res.ok) throw new Error("Play not found")
    const data = await res.json()
    setPlay(data)
    setEditingPlayType(data.playType ?? null)
    return data.teamId
  }, [])

  const fetchFormations = useCallback(async (tid: string) => {
    const res = await fetch(`/api/formations?teamId=${tid}`)
    if (res.ok) {
      const data = await res.json()
      setFormations(data)
    }
  }, [])

  const fetchDepthChart = useCallback(async (tid: string) => {
    const res = await fetch(`/api/roster/depth-chart?teamId=${tid}`, { credentials: "same-origin" })
    if (res.ok) {
      const data = await res.json()
      setDepthChartEntries(data.entries ?? [])
    }
  }, [])

  const fetchRoster = useCallback(async (tid: string) => {
    const res = await fetch(`/api/roster?teamId=${tid}`, { credentials: "same-origin" })
    if (res.ok) {
      const data = await res.json()
      setRosterPlayers(
        (data ?? []).map((p: { id: string; firstName?: string; lastName?: string; jerseyNumber?: number | null; positionGroup?: string | null }) => ({
          id: p.id,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          jerseyNumber: p.jerseyNumber ?? null,
          positionGroup: p.positionGroup ?? null,
        }))
      )
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
      .then((tid) => Promise.all([fetchFormations(tid), fetchDepthChart(tid), fetchRoster(tid)]))
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load play")
        setLoading(false)
      })
  }, [playId, fetchPlay, fetchFormations, fetchDepthChart, fetchRoster])

  const initialCanvasData: CanvasData | null = useMemo(() => {
    const raw = play?.canvasData as PlayCanvasData | null
    if (!raw?.players?.length) return null
    const coord = new FieldCoordinateSystem(800, 600, 15, 50)
    const playersWithPixels = raw.players.map((p) => {
      const hasYards = typeof p.xYards === "number" && typeof p.yYards === "number"
      const xYards = hasYards ? p.xYards : (p.x != null && p.y != null ? coord.pixelToYard(p.x, p.y).xYards : 0)
      const yYards = hasYards ? p.yYards : (p.x != null && p.y != null ? coord.pixelToYard(p.x, p.y).yYards : 0)
      const base = { ...p, x: 0, y: 0, xYards, yYards } as CanvasData["players"][number]
      const pixel = coord.yardToPixel(xYards, yYards)
      base.x = pixel.x
      base.y = pixel.y
      if (p.route?.length) {
        base.route = p.route.map((pt): RoutePoint => {
          const xYards = "xYards" in pt ? (pt as { xYards: number }).xYards : coord.pixelToYard((pt as { x: number }).x, (pt as { y: number }).y).xYards
          const yYards = "yYards" in pt ? (pt as { yYards: number }).yYards : coord.pixelToYard((pt as { x: number }).x, (pt as { y: number }).y).yYards
          const px = coord.yardToPixel(xYards, yYards)
          return { x: px.x, y: px.y, xYards, yYards, t: "t" in pt ? (pt as { t: number }).t : 0 }
        })
      }
      if (p.blockingLine) {
        const bl = p.blockingLine as { x?: number; y?: number; xYards?: number; yYards?: number }
        const xYards = bl.xYards ?? (bl.x != null ? coord.pixelToYard(bl.x, bl.y ?? 0).xYards : 0)
        const yYards = bl.yYards ?? (bl.y != null ? coord.pixelToYard(bl.x ?? 0, bl.y).yYards : 0)
        const bp = coord.yardToPixel(xYards, yYards)
        base.blockingLine = { x: bp.x, y: bp.y, xYards, yYards } as BlockEndPoint
      }
      return base
    })
    const zonesWithPixels = (raw.zones ?? []).map((z) => {
      const xY = z.xYards != null && z.yYards != null ? coord.yardToPixel(z.xYards, z.yYards) : { x: z.x ?? 0, y: z.y ?? 0 }
      return { ...z, x: xY.x, y: xY.y, xYards: z.xYards ?? 0, yYards: z.yYards ?? 0 }
    })
    return {
      players: playersWithPixels,
      zones: zonesWithPixels,
      manCoverages: raw.manCoverages ?? [],
      fieldType: raw.fieldType ?? "half",
      side: raw.side,
    }
  }, [play?.canvasData])

  const handleSave = useCallback(
    async (data: CanvasData, name: string) => {
      if (!playId || !play) return
      const coord = new FieldCoordinateSystem(800, 600, 15, 50)
      const canvasData: PlayCanvasData = {
        players: data.players.map((p) => {
          const base = {
            id: p.id,
            x: p.x,
            y: p.y,
            xYards: p.xYards ?? 0,
            yYards: p.yYards ?? 0,
            label: p.label,
            shape: p.shape,
            playerType: p.playerType,
            technique: p.technique,
            gap: p.gap,
            positionCode: (p as { positionCode?: string | null }).positionCode ?? undefined,
            positionNumber: (p as { positionNumber?: number | null }).positionNumber ?? undefined,
          }
          const route: RoutePoint[] | undefined = p.route?.length
            ? p.route.map((pt, i) => {
                const x = "x" in pt ? pt.x! : coord.yardToPixel((pt as { xYards: number }).xYards, (pt as { yYards: number }).yYards).x
                const y = "y" in pt ? pt.y! : coord.yardToPixel((pt as { xYards: number }).xYards, (pt as { yYards: number }).yYards).y
                const xYards = "xYards" in pt ? (pt as { xYards: number }).xYards : coord.pixelToYard(x, y).xYards
                const yYards = "yYards" in pt ? (pt as { yYards: number }).yYards : coord.pixelToYard(x, y).yYards
                return { x, y, xYards, yYards, t: "t" in pt ? (pt as { t: number }).t : i / (p.route!.length - 1 || 1) }
              })
            : undefined
          const blockingLine: BlockEndPoint | undefined = p.blockingLine
            ? (() => {
                const bl = p.blockingLine as { x?: number; y?: number; xYards?: number; yYards?: number }
                const xYards = bl.xYards ?? (bl.x != null ? coord.pixelToYard(bl.x, bl.y ?? 0).xYards : 0)
                const yYards = bl.yYards ?? (bl.y != null ? coord.pixelToYard(bl.x ?? 0, bl.y).yYards : 0)
                return { x: bl.x, y: bl.y, xYards, yYards }
              })()
            : undefined
          const animationTiming = (p as { animationTiming?: PlayCanvasData["players"][0]["animationTiming"] }).animationTiming
          return { ...base, route, blockingLine, ...(animationTiming != null ? { animationTiming } : {}) }
        }),
        zones: data.zones.map((z) => ({
          id: z.id,
          x: z.x,
          y: z.y,
          xYards: z.xYards,
          yYards: z.yYards,
          size: z.size,
          type: z.type,
        })),
        manCoverages: data.manCoverages ?? [],
        fieldType: data.fieldType ?? "half",
        side: data.side,
      }
      const res = await fetch(`/api/plays/${playId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          playType: editingPlayType,
          canvasData,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      const updated = await res.json()
      setPlay(updated)
    },
    [playId, play, editingPlayType]
  )

  const handleClose = useCallback(() => {
    router.push("/dashboard/playbooks")
  }, [router])

  const handleRenamePlay = useCallback(
    async (name: string) => {
      if (!playId) return
      const res = await fetch(`/api/plays/${playId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPlay(updated)
      }
    },
    [playId]
  )

  const refetchDepthChart = useCallback(async () => {
    if (!teamId) return
    const res = await fetch(`/api/roster/depth-chart?teamId=${teamId}`, { credentials: "same-origin" })
    if (res.ok) {
      const data = await res.json()
      setDepthChartEntries(data.entries ?? [])
    }
  }, [teamId])

  const onAssignSlot = useCallback(
    async (unit: string, position: string, stringNum: number, playerId: string | null) => {
      const current = depthChartEntries
        .filter((e) => e.unit === unit && e.position.toUpperCase() === position.toUpperCase())
        .sort((a, b) => a.string - b.string)
      const map = new Map<number, string | null>()
      for (const e of current) map.set(e.string, e.playerId ?? null)
      map.set(stringNum, playerId)
      const updates = Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([str, pid]) => ({ unit, position, string: str, playerId: pid }))
      const res = await fetch(`/api/roster/depth-chart?teamId=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
        credentials: "same-origin",
      })
      if (res.ok) await refetchDepthChart()
      return res.ok
    },
    [teamId, depthChartEntries, refetchDepthChart]
  )

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
          Back to Playbooks
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 h-full min-h-0 gap-px bg-slate-50">
      <div className="flex-1 flex flex-col min-w-0 rounded-l-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Preview mode toggle and animation controls */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
          <Button
            variant={previewMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => setPreviewMode((v) => !v)}
            title={previewMode ? "Exit preview" : "Preview animation"}
            className="gap-1.5"
          >
            <Film className="h-4 w-4" />
            {previewMode ? "Exit preview" : "Preview"}
          </Button>
          {previewMode && (
            <>
              <div className="h-6 w-px bg-slate-300" aria-hidden />
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={animationStepToStart} title="Step to start">
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={animationStepBackward} title="Step backward">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                {isAnimationPlaying ? (
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={animationPause} title="Pause">
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={animationPlay} title="Play">
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={animationStepForward} title="Step forward">
                  <ChevronsRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={animationRestart} title="Restart">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant={animationLoop ? "secondary" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setAnimationLoop(!animationLoop)}
                title={animationLoop ? "Loop on" : "Loop off"}
              >
                <Repeat className={`h-4 w-4 ${animationLoop ? "text-primary" : ""}`} />
              </Button>
              <Button
                variant={showRoutesInPreview ? "secondary" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowRoutesInPreview((v) => !v)}
                title={showRoutesInPreview ? "Hide routes" : "Show routes"}
              >
                <Route className={`h-4 w-4 ${showRoutesInPreview ? "text-primary" : ""}`} />
              </Button>
              <select
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(Number(e.target.value) as PlaybackSpeed)}
                className="h-8 rounded border border-input bg-background px-2 text-sm min-w-[64px]"
                title="Speed"
              >
                {SPEED_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}x</option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                {isAnimationPlaying ? "Playing" : "Paused"} · {animationSpeed}x · Routes {showRoutesInPreview ? "on" : "off"}
              </span>
            </>
          )}
        </div>
        <PlaybookBuilder
          playId={play.id}
          playData={initialCanvasData}
          playName={play.name}
          editorSourceKey={`play-${play.id}`}
          side={play.side}
          formation={play.formation}
          onSave={handleSave}
          onClose={handleClose}
          canEdit={true}
          onSelectPlayer={(player) => {
            setSelectedPlayerInspector(player)
            setInspectorSelection(player ? "player" : null)
          }}
          depthChartEntries={depthChartEntries}
          previewMode={previewMode}
          animationProgress={animationProgress}
          showRoutesInPreview={showRoutesInPreview}
        />
      </div>
      <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden rounded-r-lg border border-slate-200 bg-white shadow-sm">
        <PlaybookInspector
          play={play}
          formations={formations}
          depthChartEntries={depthChartEntries}
          rosterPlayers={rosterPlayers}
          onAssignSlot={onAssignSlot}
          selectedObject={inspectorSelection}
          selectedPlayer={selectedPlayerInspector}
          selectedZone={null}
          onPlayNameChange={handleRenamePlay}
          playType={editingPlayType}
          onPlayTypeChange={setEditingPlayType}
          canEdit={true}
        />
      </div>
    </div>
  )
}

export default function PlayEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full min-h-[60vh] bg-slate-50">
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      }
    >
      <PlayEditorContent />
    </Suspense>
  )
}
