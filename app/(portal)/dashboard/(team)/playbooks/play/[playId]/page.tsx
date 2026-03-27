"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Play, Pause, RotateCcw, SkipBack, ChevronsLeft, ChevronsRight, Repeat, Route, Film, HelpCircle, Copy, Trash2, Presentation, MoreHorizontal, PanelRight } from "lucide-react"
import { PlaybookBottomSheet } from "@/components/portal/playbook-bottom-sheet"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PlaybookBuilder, type CanvasData } from "@/components/portal/playbook-builder"
import { PlaybookInspector, type InspectorSelectedPlayer } from "@/components/portal/playbook-inspector"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { useEditorSaveState } from "@/lib/hooks/use-editor-save-state"
import { EditorSaveStatusChip } from "@/components/portal/editor-save-status"
import { LeaveWithoutSavingDialog } from "@/components/portal/leave-without-saving-dialog"
import { ConfirmDestructiveDialog } from "@/components/portal/confirm-destructive-dialog"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { usePlayAnimation, SPEED_OPTIONS, type PlaybackSpeed } from "@/lib/hooks/use-play-animation"
import type { FormationRecord, PlayRecord, RoutePoint, BlockEndPoint } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CommentThreadPanel } from "@/components/portal/comment-thread-panel"

const AUTO_SAVE_DEBOUNCE_MS = 8000

function PlayEditorContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = usePlaybookToast()
  const saveState = useEditorSaveState("saved")
  const playId = typeof params?.playId === "string" ? params.playId : null
  const returnUrl = searchParams.get("returnUrl") ?? "/dashboard/playbooks"
  const triggerSaveRef = useRef<(() => void | Promise<void>) | null>(null)

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
  const [appliedRoutePreset, setAppliedRoutePreset] = useState<{ playerId: string; presetId: string } | null>(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeletingPlay, setIsDeletingPlay] = useState(false)
  const [isDuplicatingPlay, setIsDuplicatingPlay] = useState(false)
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false)
  const [editorMoreOpen, setEditorMoreOpen] = useState(false)

  const {
    progress: animationProgress,
    isPlaying: isAnimationPlaying,
    state: playbackState,
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
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = typeof data?.error === "string" ? data.error : res.status === 404 ? "Play not found" : "Failed to load play"
      throw new Error(message)
    }
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
    const res = await fetch(`/api/roster?teamId=${tid}&lite=1`, { credentials: "same-origin" })
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
          const preSnapMotion = (p as { preSnapMotion?: PlayCanvasData["players"][0]["preSnapMotion"] }).preSnapMotion
          return {
            ...base,
            route,
            blockingLine,
            ...(animationTiming != null ? { animationTiming } : {}),
            ...(preSnapMotion != null ? { preSnapMotion } : {}),
          }
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
      saveState.setSaving()
      const res = await fetch(`/api/plays/${playId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          playType: editingPlayType,
          canvasData,
          tags: play.tags ?? undefined,
        }),
      })
      if (!res.ok) {
        saveState.setError()
        showToast("Save failed. Please try again.", "error")
        throw new Error("Failed to save")
      }
      const updated = await res.json()
      setPlay(updated)
      saveState.setSaved()
      showToast("Play saved", "success")
    },
    [playId, play, editingPlayType, showToast, saveState.setSaving, saveState.setSaved, saveState.setError]
  )

  const handleTagsChange = useCallback((tags: string[]) => {
    setPlay((prev) => (prev ? { ...prev, tags } : null))
  }, [])

  const handleApplyRoutePreset = useCallback((presetId: string) => {
    const pid = selectedPlayerInspector?.id
    if (!pid) return
    setAppliedRoutePreset({ playerId: pid, presetId })
  }, [selectedPlayerInspector?.id])

  useEffect(() => {
    if (!autoSaveEnabled || saveState.status !== "dirty") return
    const t = setTimeout(() => {
      triggerSaveRef.current?.()
    }, AUTO_SAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [autoSaveEnabled, saveState.status])

  const handleClose = useCallback(() => {
    saveState.confirmBeforeNavigate(() => router.push(returnUrl))
  }, [router, returnUrl, saveState.confirmBeforeNavigate])

  const handleDuplicatePlay = useCallback(async () => {
    if (!playId) return
    setIsDuplicatingPlay(true)
    try {
      const res = await fetch(`/api/plays/${playId}/duplicate`, { method: "POST", credentials: "same-origin" })
      if (!res.ok) throw new Error("Duplicate failed")
      const newPlay = await res.json()
      showToast("Play duplicated", "success")
      router.push(`/dashboard/playbooks/play/${newPlay.id}?returnUrl=${encodeURIComponent(returnUrl)}`)
    } catch {
      showToast("Could not duplicate play", "error")
    } finally {
      setIsDuplicatingPlay(false)
    }
  }, [playId, returnUrl, router, showToast])

  const handleDeletePlay = useCallback(async () => {
    if (!playId) return
    setIsDeletingPlay(true)
    try {
      const res = await fetch(`/api/plays/${playId}`, { method: "DELETE", credentials: "same-origin" })
      if (res.ok) {
        showToast("Play deleted", "success")
        setDeleteDialogOpen(false)
        router.push(returnUrl)
      } else {
        showToast("Could not delete play", "error")
      }
    } catch {
      showToast("Could not delete play", "error")
    } finally {
      setIsDeletingPlay(false)
    }
  }, [playId, returnUrl, router, showToast])

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
          onClick={() => router.push(returnUrl)}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Back
        </button>
      </div>
    )
  }

  const inspectorPanel = (
    <div className="flex flex-col min-h-0 flex-1 lg:h-full max-h-[min(75vh,560px)] lg:max-h-none">
      <div className="flex-1 min-h-0 overflow-y-auto min-w-0">
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
          tags={play.tags ?? null}
          onTagsChange={handleTagsChange}
          onApplyRoutePreset={handleApplyRoutePreset}
          canEdit={true}
        />
      </div>
      <div className="flex-shrink-0 border-t border-slate-200 p-2">
        <CommentThreadPanel parentType="play" parentId={play.id} defaultCollapsed={true} />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row flex-1 h-full min-h-0 max-lg:min-h-[calc(100dvh-3.25rem)] gap-0 lg:gap-px bg-slate-50 max-w-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 min-h-0 rounded-none lg:rounded-l-lg border-0 lg:border border-slate-200 bg-white shadow-sm overflow-hidden order-1">
        {/* Desktop toolbar */}
        <div className="hidden lg:flex items-center gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/80 flex-shrink-0 flex-wrap">
          <EditorSaveStatusChip status={saveState.status} lastSavedAt={saveState.lastSavedAt} />
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-save-play" className="text-xs text-slate-600 whitespace-nowrap cursor-pointer">Auto-save</Label>
            <Checkbox
              id="auto-save-play"
              checked={autoSaveEnabled}
              onCheckedChange={setAutoSaveEnabled}
            />
          </div>
          <Button
            variant={previewMode ? "secondary" : "default"}
            size="sm"
            onClick={() => setPreviewMode((v) => !v)}
            title={previewMode ? "Exit preview" : "Preview play animation (pre-snap motion, then routes)"}
            className="gap-1.5"
          >
            <Film className="h-4 w-4" />
            {previewMode ? "Exit preview" : "Preview Play"}
          </Button>
          {previewMode && (
            <>
              <div className="h-6 w-px bg-slate-300" aria-hidden />
              {/* Primary preview controls: Play, Pause, Restart — visible and grouped */}
              <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-0.5" role="group" aria-label="Preview playback">
                {isAnimationPlaying ? (
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={animationPause} title="Pause">
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={animationPlay} title="Play">
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={animationRestart} title="Restart from beginning">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-xs font-medium text-slate-600 capitalize tabular-nums" aria-live="polite">
                {playbackState}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={animationStepToStart} title="Step to start">
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={animationStepBackward} title="Step backward">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={animationStepForward} title="Step forward">
                  <ChevronsRight className="h-4 w-4" />
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
                {animationSpeed}x · Routes {showRoutesInPreview ? "on" : "off"}
              </span>
            </>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700" title="Keyboard shortcuts">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <p className="font-semibold text-slate-800 mb-2">Keyboard shortcuts</p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li><kbd className="px-1 rounded bg-slate-100 font-mono">Ctrl</kbd>+<kbd className="px-1 rounded bg-slate-100 font-mono">S</kbd> Save</li>
                <li><kbd className="px-1 rounded bg-slate-100 font-mono">V</kbd> Select tool</li>
                <li><kbd className="px-1 rounded bg-slate-100 font-mono">R</kbd> Route tool</li>
                <li><kbd className="px-1 rounded bg-slate-100 font-mono">B</kbd> Block tool</li>
                <li><kbd className="px-1 rounded bg-slate-100 font-mono">M</kbd> Motion tool</li>
                <li><kbd className="px-1 rounded bg-slate-100 font-mono">Del</kbd>/<kbd className="px-1 rounded bg-slate-100 font-mono">Bksp</kbd> Delete selected</li>
                <li><kbd className="px-1 rounded bg-slate-100 font-mono">Esc</kbd> Cancel / clear selection</li>
              </ul>
              <p className="font-semibold text-slate-800 mb-2 mt-3">Preview</p>
              <p className="text-xs text-slate-600">Use &quot;Preview Play&quot; then Play, Pause, and Restart in the toolbar. Pre-snap motion runs first, then routes.</p>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => router.push(`/dashboard/playbooks/play/${play.id}/present`)}
            title="Open presenter view"
          >
            <Presentation className="h-4 w-4 mr-1" />
            Presenter
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={isDuplicatingPlay}
            onClick={handleDuplicatePlay}
            title="Duplicate this play"
          >
            <Copy className="h-4 w-4 mr-1" />
            Duplicate play
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 ml-auto"
            onClick={() => setDeleteDialogOpen(true)}
            title="Delete this play"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete play
          </Button>
        </div>

        {!previewMode && (
          <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white flex-shrink-0">
            <EditorSaveStatusChip status={saveState.status} lastSavedAt={saveState.lastSavedAt} />
            <Button
              variant="default"
              size="touch"
              className="shrink-0 px-3"
              onClick={() => setPreviewMode(true)}
              title="Preview play"
            >
              <Film className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="touch"
              className="gap-1.5 ml-auto min-w-0 px-3"
              onClick={() => setInspectorSheetOpen(true)}
            >
              <PanelRight className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold truncate">Details</span>
            </Button>
            <Button variant="outline" size="touch" className="h-11 w-11 shrink-0 p-0" onClick={() => setEditorMoreOpen(true)} aria-label="More">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        )}

        <PlaybookBottomSheet open={inspectorSheetOpen} onOpenChange={setInspectorSheetOpen} title="Play details">
          {inspectorPanel}
        </PlaybookBottomSheet>
        <PlaybookBottomSheet open={editorMoreOpen} onOpenChange={setEditorMoreOpen} title="Editor">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id="auto-m" checked={autoSaveEnabled} onCheckedChange={setAutoSaveEnabled} />
              <Label htmlFor="auto-m" className="text-sm">Auto-save</Label>
            </div>
            <Button variant="outline" className="w-full justify-start h-12 rounded-xl gap-2" onClick={() => { setEditorMoreOpen(false); router.push(`/dashboard/playbooks/play/${play.id}/present`) }}>
              <Presentation className="h-4 w-4" /> Presenter
            </Button>
            <Button variant="outline" className="w-full justify-start h-12 rounded-xl gap-2" disabled={isDuplicatingPlay} onClick={() => { setEditorMoreOpen(false); handleDuplicatePlay() }}>
              <Copy className="h-4 w-4" /> Duplicate play
            </Button>
            <Button variant="outline" className="w-full justify-start h-12 rounded-xl gap-2 text-red-600 border-red-200" onClick={() => { setEditorMoreOpen(false); setDeleteDialogOpen(true) }}>
              <Trash2 className="h-4 w-4" /> Delete play
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="w-full h-11 rounded-xl">Keyboard shortcuts</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="center">
                <p className="font-semibold text-sm mb-2">Shortcuts</p>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li>Ctrl+S Save</li>
                  <li>V / R / B / M Tools</li>
                </ul>
              </PopoverContent>
            </Popover>
          </div>
        </PlaybookBottomSheet>

        <ConfirmDestructiveDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete this play?"
          message="This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleDeletePlay}
          isDeleting={isDeletingPlay}
        />
        <PlaybookBuilder
          playId={play.id}
          playData={initialCanvasData}
          playName={play.name}
          editorSourceKey={`play-${play.id}`}
          side={play.side}
          formation={play.formation}
          onSave={handleSave}
          onClose={handleClose}
          onDirty={saveState.setDirty}
          appliedRoutePreset={appliedRoutePreset}
          onClearAppliedRoutePreset={() => setAppliedRoutePreset(null)}
          triggerSaveRef={triggerSaveRef}
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

        {previewMode && (
          <div
            className="lg:hidden fixed inset-x-0 z-[55] rounded-t-2xl border border-b-0 border-slate-200 bg-white/95 pl-4 pt-3 pr-[max(1rem,calc(3.5rem+env(safe-area-inset-right,0px)+0.75rem))] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] backdrop-blur-md"
            style={{
              bottom: 0,
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <Button type="button" variant="default" size="touch" className="shrink-0 gap-2" onClick={() => setPreviewMode(false)}>
                <Film className="h-4 w-4 shrink-0" />
                Exit preview
              </Button>
              <span className="mobile-text-caption max-w-[40%] truncate capitalize text-slate-600" aria-live="polite">
                {playbackState}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-2">
              {isAnimationPlaying ? (
                <Button variant="secondary" size="icon" className="h-11 w-11 rounded-[12px]" onClick={animationPause} aria-label="Pause">
                  <Pause className="h-5 w-5" />
                </Button>
              ) : (
                <Button variant="default" size="icon" className="h-11 w-11 rounded-[12px]" onClick={animationPlay} aria-label="Play">
                  <Play className="h-5 w-5" />
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-[12px]" onClick={animationRestart} aria-label="Restart">
                <RotateCcw className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-[12px]" onClick={animationStepToStart} aria-label="Step to start">
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-[12px]" onClick={animationStepBackward} aria-label="Step back">
                <ChevronsLeft className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-[12px]" onClick={animationStepForward} aria-label="Step forward">
                <ChevronsRight className="h-5 w-5" />
              </Button>
              <Button
                variant={animationLoop ? "secondary" : "outline"}
                size="icon"
                className="h-11 w-11 rounded-[12px]"
                onClick={() => setAnimationLoop(!animationLoop)}
                aria-label={animationLoop ? "Loop on" : "Loop off"}
              >
                <Repeat className={`h-5 w-5 ${animationLoop ? "text-primary" : ""}`} />
              </Button>
              <Button
                variant={showRoutesInPreview ? "secondary" : "outline"}
                size="icon"
                className="h-11 w-11 rounded-[12px]"
                onClick={() => setShowRoutesInPreview((v) => !v)}
                aria-label="Toggle routes"
              >
                <Route className={`h-5 w-5 ${showRoutesInPreview ? "text-primary" : ""}`} />
              </Button>
              <select
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(Number(e.target.value) as PlaybackSpeed)}
                className="h-11 min-w-[4.5rem] rounded-[12px] border border-input bg-background px-2 text-sm font-medium"
                title="Speed"
                aria-label="Playback speed"
              >
                {SPEED_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <LeaveWithoutSavingDialog
          open={saveState.leaveDialogOpen}
          onOpenChange={(open) => { if (!open) saveState.handleLeaveCancel(); saveState.setLeaveDialogOpen(open); }}
          onConfirm={saveState.handleLeaveConfirm}
          onCancel={saveState.handleLeaveCancel}
        />
      </div>
      <div className="hidden lg:flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-r-lg border border-slate-200 bg-white shadow-sm min-h-0">
        {inspectorPanel}
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
