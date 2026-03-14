"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ZoomIn, ZoomOut, RotateCcw, RotateCw, Undo2 } from "lucide-react"

const CROP_SIZE = 280
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

export interface PlayerPhotoCropModalProps {
  open: boolean
  imageUrl: string
  fileName?: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

export function PlayerPhotoCropModal({
  open,
  imageUrl,
  fileName = "photo.jpg",
  onConfirm,
  onCancel,
}: PlayerPhotoCropModalProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0) // degrees: 0, 90, 180, 270
  const [dragStart, setDragStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const [exporting, setExporting] = useState(false)

  const fitScale = naturalSize.w > 0 && naturalSize.h > 0
    ? Math.min(CROP_SIZE / naturalSize.w, CROP_SIZE / naturalSize.h)
    : 1
  const displayScale = fitScale * scale
  const displayW = naturalSize.w * displayScale
  const displayH = naturalSize.h * displayScale
  const innerSize = Math.max(displayW, displayH)
  const left = CROP_SIZE / 2 - innerSize / 2 + offset.x
  const top = CROP_SIZE / 2 - innerSize / 2 + offset.y

  const handleLoad = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    const w = img.naturalWidth
    const h = img.naturalHeight
    setNaturalSize({ w, h })
    setLoaded(true)
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setRotation(0)
  }, [])

  useEffect(() => {
    if (!open) return
    setLoaded(false)
    setNaturalSize({ w: 0, h: 0 })
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setRotation(0)
    setDragStart(null)
  }, [open, imageUrl])

  const handleReset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setRotation(0)
  }, [])

  const handleRotateLeft = useCallback(() => {
    setRotation((r) => (r - 90 + 360) % 360)
  }, [])

  const handleRotateRight = useCallback(() => {
    setRotation((r) => (r + 90) % 360)
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setDragStart({ x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [offset.x, offset.y])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStart) return
      setOffset({
        x: dragStart.offsetX + (e.clientX - dragStart.x),
        y: dragStart.offsetY + (e.clientY - dragStart.y),
      })
    },
    [dragStart]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    setDragStart(null)
  }, [])

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_ZOOM, s + ZOOM_STEP))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_ZOOM, s - ZOOM_STEP))
  }, [])

  const getOutputBlob = useCallback(
    (mimeType: string): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const img = imgRef.current
        if (!img || !loaded || naturalSize.w === 0) {
          reject(new Error("Image not ready"))
          return
        }
        const canvas = document.createElement("canvas")
        canvas.width = CROP_SIZE
        canvas.height = CROP_SIZE
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas not available"))
          return
        }
        const cx = CROP_SIZE / 2
        const rad = (rotation * Math.PI) / 180
        ctx.save()
        ctx.rect(0, 0, CROP_SIZE, CROP_SIZE)
        ctx.clip()
        ctx.translate(cx + offset.x, cx + offset.y)
        ctx.rotate(rad)
        ctx.scale(displayScale, displayScale)
        ctx.translate(-naturalSize.w / 2, -naturalSize.h / 2)
        ctx.drawImage(img, 0, 0, naturalSize.w, naturalSize.h)
        ctx.restore()
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
          mimeType,
          0.92
        )
      })
    },
    [loaded, naturalSize, displayScale, offset.x, offset.y, rotation]
  )

  const handleApply = useCallback(async () => {
    if (!loaded) return
    setExporting(true)
    try {
      const blob = await getOutputBlob("image/jpeg")
      onConfirm(blob)
    } catch (err) {
      console.error("[PlayerPhotoCropModal] export", err)
    } finally {
      setExporting(false)
    }
  }, [loaded, getOutputBlob, onConfirm])

  const handleCancel = useCallback(() => {
    onCancel()
  }, [onCancel])

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-[min(90vw,340px)] p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Adjust photo</h3>
        <p className="text-xs text-slate-500 mb-3">Drag to reposition, use zoom to fit. The square area will be used as your photo.</p>

        <div
          className="relative rounded-lg border border-slate-200 bg-slate-100 overflow-hidden touch-none"
          style={{ width: CROP_SIZE, height: CROP_SIZE }}
        >
          <div
            className="absolute cursor-move flex items-center justify-center"
            style={{
              left,
              top,
              width: Math.max(1, innerSize),
              height: Math.max(1, innerSize),
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              className="block pointer-events-none flex-shrink-0"
              draggable={false}
              onLoad={handleLoad}
              style={{
                width: displayW,
                height: displayH,
                maxWidth: "none",
                maxHeight: "none",
                transform: `rotate(${rotation}deg)`,
              }}
            />
          </div>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={zoomOut} disabled={!loaded} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full h-2 accent-slate-600"
              disabled={!loaded}
              aria-label="Zoom"
            />
          </div>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={zoomIn} disabled={!loaded} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleRotateLeft} disabled={!loaded} aria-label="Rotate left">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Left</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleRotateRight} disabled={!loaded} aria-label="Rotate right">
            <RotateCw className="h-3.5 w-3.5" />
            <span>Right</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1 ml-auto" onClick={handleReset} disabled={!loaded} aria-label="Reset">
            <Undo2 className="h-3.5 w-3.5" />
            <span>Reset</span>
          </Button>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={exporting}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleApply} disabled={!loaded || exporting}>
            {exporting ? "Applying…" : "Apply"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
