"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { PlayRecord } from "@/types/playbook"

interface PlaybookInspectorProps {
  play: PlayRecord | null
  selectedObject: "play" | "player" | "zone" | "route" | null
  selectedPlayer?: { id: string; label: string; shape: string } | null
  selectedZone?: { id: string; type: string; size: string } | null
  onPlayNameChange?: (name: string) => void
  onPlayerLabelChange?: (playerId: string, label: string) => void
  canEdit: boolean
}

export function PlaybookInspector({
  play,
  selectedObject,
  selectedPlayer,
  selectedZone,
  onPlayNameChange,
  onPlayerLabelChange,
  canEdit,
}: PlaybookInspectorProps) {
  if (!play && !selectedObject) {
    return (
      <div className="p-4 border-l border-border bg-muted/30 h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a play or an object on the field</p>
      </div>
    )
  }

  return (
    <div className="w-64 border-l border-border bg-background flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {play && (selectedObject === "play" || !selectedObject) && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Play name</Label>
            {canEdit && onPlayNameChange ? (
              <Input
                value={play.name}
                onChange={(e) => onPlayNameChange(e.target.value)}
                className="h-8 text-sm"
              />
            ) : (
              <p className="text-sm font-medium text-foreground">{play.name}</p>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Side: <span className="capitalize text-foreground">{play.side.replace("_", " ")}</span></p>
              <p>Formation: <span className="text-foreground">{play.formation || "—"}</span></p>
              {play.subcategory && (
                <p>Subcategory: <span className="text-foreground">{play.subcategory}</span></p>
              )}
            </div>
          </div>
        )}

        {selectedObject === "player" && selectedPlayer && onPlayerLabelChange && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Player label</Label>
            {canEdit ? (
              <Input
                value={selectedPlayer.label}
                onChange={(e) => onPlayerLabelChange(selectedPlayer.id, e.target.value.toUpperCase().slice(0, 2))}
                className="h-8 text-sm"
                maxLength={2}
              />
            ) : (
              <p className="text-sm font-medium text-foreground">{selectedPlayer.label}</p>
            )}
            <p className="text-xs text-muted-foreground">Shape: {selectedPlayer.shape}</p>
          </div>
        )}

        {selectedObject === "zone" && selectedZone && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Zone</Label>
            <p className="text-sm text-foreground">Type: {selectedZone.type}</p>
            <p className="text-xs text-muted-foreground">Size: {selectedZone.size}</p>
          </div>
        )}

        {selectedObject === "route" && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Route</Label>
            <p className="text-xs text-muted-foreground">Route segment selected. Edit by redrawing or moving points.</p>
          </div>
        )}
      </div>
    </div>
  )
}
