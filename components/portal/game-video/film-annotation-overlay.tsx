"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Circle, Minus, MousePointer2, Pencil, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type FilmAnnotationTool = "none" | "pen" | "line" | "arrow" | "circle"

type Norm = { nx: number; ny: number }

export type FilmAnnotationStroke =
  | { id: string; kind: "pen"; color: string; lineWidth: number; points: Norm[] }
  | { id: string; kind: "line" | "arrow"; color: string; lineWidth: number; a: Norm; b: Norm }
  | { id: string; kind: "circle"; color: string; lineWidth: number; c: Norm; r: number }

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const bx = x2 - ux * size
  const by = y2 - uy * size
  const px = -uy * (size * 0.55)
  const py = ux * (size * 0.55)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(bx + px, by + py)
  ctx.lineTo(bx - px, by - py)
  ctx.closePath()
  ctx.fill()
}

type PreviewState =
  | { kind: "pen"; color: string; lineWidth: number; points: Norm[] }
  | { kind: "line" | "arrow"; color: string; lineWidth: number; a: Norm; b: Norm }
  | { kind: "circle"; color: string; lineWidth: number; c: Norm; r: number }

function previewToTempStroke(p: PreviewState): FilmAnnotationStroke | null {
  if (p.kind === "pen") {
    if (p.points.length < 2) return null
    return { id: "__preview", kind: "pen", color: p.color, lineWidth: p.lineWidth, points: p.points }
  }
  if (p.kind === "line" || p.kind === "arrow") {
    const dx = p.b.nx - p.a.nx
    const dy = p.b.ny - p.a.ny
    if (Math.hypot(dx, dy) < 0.004) return null
    return { id: "__preview", kind: p.kind, color: p.color, lineWidth: p.lineWidth, a: p.a, b: p.b }
  }
  if (p.kind === "circle") {
    if (p.r < 0.008) return null
    return { id: "__preview", kind: "circle", color: p.color, lineWidth: p.lineWidth, c: p.c, r: p.r }
  }
  return null
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strokes: FilmAnnotationStroke[],
  preview: PreviewState | null,
) {
  ctx.clearRect(0, 0, w, h)
  const temp = preview ? previewToTempStroke(preview) : null
  const drawList: FilmAnnotationStroke[] = temp ? [...strokes, temp] : strokes
  for (const s of drawList) {
    ctx.strokeStyle = s.color
    ctx.fillStyle = s.color
    ctx.lineWidth = s.lineWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    if (s.kind === "pen") {
      if (s.points.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(s.points[0].nx * w, s.points[0].ny * h)
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].nx * w, s.points[i].ny * h)
      }
      ctx.stroke()
    } else if (s.kind === "line" || s.kind === "arrow") {
      const x1 = s.a.nx * w
      const y1 = s.a.ny * h
      const x2 = s.b.nx * w
      const y2 = s.b.ny * h
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      if (s.kind === "arrow") {
        drawArrowHead(ctx, x1, y1, x2, y2, Math.max(10, s.lineWidth * 3))
      }
    } else if (s.kind === "circle") {
      ctx.beginPath()
      ctx.arc(s.c.nx * w, s.c.ny * h, s.r * Math.min(w, h), 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

export function FilmAnnotationToolbar({
  activeTool,
  onToolChange,
  onUndo,
  onClear,
  canUndo,
  hasInk,
  disabled,
}: {
  activeTool: FilmAnnotationTool
  onToolChange: (t: FilmAnnotationTool) => void
  onUndo: () => void
  onClear: () => void
  canUndo: boolean
  hasInk: boolean
  disabled?: boolean
}) {
  const btn = (t: FilmAnnotationTool, label: string, icon: React.ReactNode) => (
    <Button
      type="button"
      size="sm"
      variant={activeTool === t ? "default" : "secondary"}
      disabled={disabled}
      className={cn(
        "h-8 min-w-0 shrink-0 gap-1 px-2 text-[11px] font-semibold sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-xs",
        activeTool === t && "bg-sky-600 text-white hover:bg-sky-600/90",
        activeTool !== t &&
          "border border-white/20 bg-slate-800/95 text-slate-100 hover:bg-slate-700 hover:text-white",
      )}
      onClick={() => onToolChange(activeTool === t ? "none" : t)}
      aria-pressed={activeTool === t}
      title={label}
    >
      {icon}
      <span>{label}</span>
    </Button>
  )

  return (
    <div
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-white/15 bg-slate-950/90 px-2 py-1.5 shadow-sm"
      role="toolbar"
      aria-label="Film annotations"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-300">Draw</span>
        {btn("pen", "Pen", <Pencil className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />)}
        {btn("line", "Line", <Minus className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />)}
        {btn("arrow", "Arrow", <MousePointer2 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />)}
        {btn("circle", "Circle", <Circle className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />)}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-white/10 pt-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || !canUndo}
          className="h-8 shrink-0 gap-1 border border-white/15 bg-slate-800/95 px-2 text-[11px] font-semibold text-slate-100 hover:bg-slate-700 sm:h-9 sm:px-2.5 sm:text-xs"
          onClick={onUndo}
          title="Undo last stroke"
        >
          <Undo2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
          Undo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || !hasInk}
          className="h-8 shrink-0 gap-1 border border-white/20 bg-slate-900/80 px-2 text-[11px] font-semibold text-slate-200 hover:bg-red-950/50 hover:text-red-100 sm:h-9 sm:px-2.5 sm:text-xs"
          onClick={onClear}
          title="Clear all drawings"
        >
          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  )
}

export function FilmAnnotationOverlay({
  activeTool,
  strokes,
  onStrokesChange,
  strokeColor = "#fbbf24",
  lineWidth = 2.75,
  className,
}: {
  activeTool: FilmAnnotationTool
  strokes: FilmAnnotationStroke[]
  onStrokesChange: (next: FilmAnnotationStroke[]) => void
  strokeColor?: string
  lineWidth?: number
  className?: string
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    if (w < 2 || h < 2) return
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(ctx, w, h, strokes, preview)
  }, [strokes, preview])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => redraw())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [redraw])

  const normFromEvent = (e: React.PointerEvent | PointerEvent): Norm | null => {
    const wrap = wrapRef.current
    if (!wrap) return null
    const r = wrap.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width
    const ny = (e.clientY - r.top) / r.height
    return { nx: Math.min(1, Math.max(0, nx)), ny: Math.min(1, Math.max(0, ny)) }
  }

  const strokesRef = useRef(strokes)
  strokesRef.current = strokes

  const commitPreview = () => {
    setPreview((prev) => {
      if (!prev) return null
      const committed = previewToTempStroke(prev)
      if (!committed) return null
      const stroke: FilmAnnotationStroke = { ...committed, id: uid() }
      onStrokesChange([...strokesRef.current, stroke])
      return null
    })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (activeTool === "none") return
    e.preventDefault()
    const n = normFromEvent(e)
    if (!n) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    if (activeTool === "pen") {
      setPreview({ kind: "pen", color: strokeColor, lineWidth, points: [n] })
    } else if (activeTool === "line" || activeTool === "arrow") {
      setPreview({ kind: activeTool, color: strokeColor, lineWidth, a: n, b: n })
    } else if (activeTool === "circle") {
      setPreview({ kind: "circle", color: strokeColor, lineWidth, c: n, r: 0 })
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!preview) return
    const n = normFromEvent(e)
    if (!n) return
    setPreview((prev) => {
      if (!prev) return null
      if (prev.kind === "pen") {
        const last = prev.points[prev.points.length - 1]
        const dx = n.nx - last.nx
        const dy = n.ny - last.ny
        if (Math.hypot(dx, dy) < 0.002) return prev
        return { ...prev, points: [...prev.points, n] }
      }
      if (prev.kind === "line" || prev.kind === "arrow") {
        return { ...prev, b: n }
      }
      if (prev.kind === "circle") {
        const dx = n.nx - prev.c.nx
        const dy = n.ny - prev.c.ny
        const r = Math.hypot(dx, dy)
        return { ...prev, r }
      }
      return prev
    })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!preview) return
    e.preventDefault()
    commitPreview()
  }

  const interactive = activeTool !== "none"

  return (
    <div
      ref={wrapRef}
      className={cn(
        "pointer-events-none absolute inset-0 z-[5]",
        interactive && "pointer-events-auto touch-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setPreview(null)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
    </div>
  )
}
