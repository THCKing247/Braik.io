"use client"

import { useRef, useCallback } from "react"

interface ResizableHorizontalHandleProps {
  onDrag: (totalDeltaY: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  className?: string
}

/**
 * A horizontal bar that the user can drag to resize panels vertically.
 * Reports total delta Y from drag start on each move; parent clamps and sets height.
 */
export function ResizableHorizontalHandle({
  onDrag,
  onDragStart,
  onDragEnd,
  className = "",
}: ResizableHorizontalHandleProps) {
  const initialYRef = useRef(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      initialYRef.current = e.clientY
      onDragStart?.()

      const handleMove = (moveEvent: MouseEvent) => {
        const totalDeltaY = moveEvent.clientY - initialYRef.current
        onDrag(totalDeltaY)
      }

      const handleUp = () => {
        document.removeEventListener("mousemove", handleMove)
        document.removeEventListener("mouseup", handleUp)
        onDragEnd?.()
      }

      document.addEventListener("mousemove", handleMove)
      document.addEventListener("mouseup", handleUp)
    },
    [onDrag, onDragStart, onDragEnd]
  )

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`group h-3 flex items-center justify-center cursor-row-resize select-none shrink-0 border-y border-slate-200 bg-slate-50/80 hover:bg-slate-100/80 active:bg-slate-200/80 transition-colors ${className}`}
      onPointerDown={handlePointerDown}
    >
      <div
        className="h-1 w-16 rounded-full bg-slate-300 group-hover:bg-slate-400 pointer-events-none"
        aria-hidden
      />
    </div>
  )
}
