"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { getPlayFormationDisplayName, isPlayFormationOrphan } from "@/lib/utils/playbook-formation"
import type { PlayRecord, FormationRecord } from "@/types/playbook"

interface PlaybookInspectorProps {
  play: PlayRecord | null
  /** When provided, formation is resolved from the record (formationId-first). */
  formations?: FormationRecord[] | null
  selectedObject: "play" | "player" | "zone" | "route" | null
  selectedPlayer?: { id: string; label: string; shape: string } | null
  selectedZone?: { id: string; type: string; size: string } | null
  onPlayNameChange?: (name: string) => void
  onPlayerLabelChange?: (playerId: string, label: string) => void
  canEdit: boolean
}

export function PlaybookInspector({
  play,
  formations,
  selectedObject,
  selectedPlayer,
  selectedZone,
  onPlayNameChange,
  onPlayerLabelChange,
  canEdit,
}: PlaybookInspectorProps) {
  if (!play && !selectedObject) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-slate-500">Select a play or an object on the field</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">Properties</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {play && (selectedObject === "play" || !selectedObject) && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Play name</Label>
            {canEdit && onPlayNameChange ? (
              <Input
                value={play.name}
                onChange={(e) => onPlayNameChange(e.target.value)}
                className="h-8 text-sm border-slate-200"
              />
            ) : (
              <p className="text-sm font-medium text-slate-800">{play.name}</p>
            )}
            <div className="text-xs text-slate-500 space-y-1">
              <p>Side: <span className="capitalize text-slate-800">{play.side.replace("_", " ")}</span></p>
              <p>
                Formation: <span className="text-slate-800">{getPlayFormationDisplayName(play, formations)}</span>
                {isPlayFormationOrphan(play) && (
                  <span className="ml-1 text-slate-400" title="Play is not linked to a formation record">(name only)</span>
                )}
              </p>
              {play.subcategory && (
                <p>Subcategory: <span className="text-slate-800">{play.subcategory}</span></p>
              )}
            </div>
          </div>
        )}

        {selectedObject === "player" && selectedPlayer && onPlayerLabelChange && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Player label</Label>
            {canEdit ? (
              <Input
                value={selectedPlayer.label}
                onChange={(e) => onPlayerLabelChange(selectedPlayer.id, e.target.value.toUpperCase().slice(0, 2))}
                className="h-8 text-sm border-slate-200"
                maxLength={2}
              />
            ) : (
              <p className="text-sm font-medium text-slate-800">{selectedPlayer.label}</p>
            )}
            <p className="text-xs text-slate-500">Shape: {selectedPlayer.shape}</p>
          </div>
        )}

        {selectedObject === "zone" && selectedZone && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Zone</Label>
            <p className="text-sm text-slate-800">Type: {selectedZone.type}</p>
            <p className="text-xs text-slate-500">Size: {selectedZone.size}</p>
          </div>
        )}

        {selectedObject === "route" && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Route</Label>
            <p className="text-xs text-slate-500">Route segment selected. Edit by redrawing or moving points.</p>
          </div>
        )}
      </div>
    </div>
  )
}
