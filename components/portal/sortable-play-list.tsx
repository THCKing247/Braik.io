"use client"

import { useState, useCallback } from "react"
import type { PlayRecord } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"
import type { FormationRecord } from "@/types/playbook"
import { PlayCard } from "@/components/portal/play-card"
import { usePlaybookToast } from "@/components/portal/playbook-toast"

interface SortablePlayListProps {
  plays: PlayRecord[]
  formations: FormationRecord[]
  depthChartEntries: DepthChartSlot[]
  canEdit: boolean
  playEditorPath: (playId: string) => string
  onDuplicate: (playId: string) => void
  onRename: (playId: string, newName: string) => void
  onDelete: (playId: string) => void
  onReorder: (reordered: PlayRecord[]) => void
  /** e.g. playbookId for top-level, or formationId for formation-scoped */
  reorderScopeKey: string
}

export function SortablePlayList({
  plays,
  formations,
  depthChartEntries,
  canEdit,
  playEditorPath,
  onDuplicate,
  onRename,
  onDelete,
  onReorder,
  reorderScopeKey,
}: SortablePlayListProps) {
  const { showToast } = usePlaybookToast()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const movePlay = useCallback(
    (fromIndex: number, toIndex: number): PlayRecord[] => {
      if (fromIndex === toIndex) return plays
      const next = [...plays]
      const [removed] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, removed)
      return next
    },
    [plays]
  )

  const persistOrder = useCallback(
    async (ordered: PlayRecord[]) => {
      const items = ordered.map((p, i) => ({ id: p.id, orderIndex: i }))
      const res = await fetch("/api/plays/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error("Reorder failed")
    },
    []
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent, playId: string) => {
      if (!canEdit) return
      setDraggedId(playId)
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", playId)
      e.dataTransfer.setData("application/x-play-id", playId)
    },
    [canEdit]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent, playId: string) => {
      if (!canEdit || !draggedId || draggedId === playId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setDragOverId(playId)
    },
    [canEdit, draggedId]
  )

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, dropPlayId: string) => {
      e.preventDefault()
      setDragOverId(null)
      setDraggedId(null)
      if (!canEdit || !draggedId || draggedId === dropPlayId) return
      const fromIndex = plays.findIndex((p) => p.id === draggedId)
      const toIndex = plays.findIndex((p) => p.id === dropPlayId)
      if (fromIndex === -1 || toIndex === -1) return
      const ordered = movePlay(fromIndex, toIndex)
      onReorder(ordered)
      persistOrder(ordered).catch(() => {
        onReorder(plays)
        showToast("Could not reorder plays", "error")
      })
    },
    [canEdit, draggedId, plays, movePlay, onReorder, persistOrder, showToast]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDragOverId(null)
  }, [])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {plays.map((play, index) => (
        <div
          key={play.id}
          className={`min-w-[200px] w-full transition-opacity ${draggedId === play.id ? "opacity-50" : ""} ${dragOverId === play.id ? "ring-2 ring-blue-400 ring-offset-2 rounded-xl" : ""}`}
          draggable={canEdit}
          onDragStart={(e) => handleDragStart(e, play.id)}
          onDragOver={(e) => handleDragOver(e, play.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, play.id)}
          onDragEnd={handleDragEnd}
        >
          <PlayCard
            play={play}
            formations={formations}
            depthChartEntries={depthChartEntries}
            isSelected={false}
            onOpen={() => {}}
            onDuplicate={onDuplicate}
            onRename={onRename}
            onDelete={onDelete}
            canEdit={canEdit}
            viewMode="grid"
            playEditorPath={playEditorPath}
          />
        </div>
      ))}
    </div>
  )
}
