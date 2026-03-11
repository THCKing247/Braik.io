"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { getPlayFormationDisplayName, isPlayFormationOrphan } from "@/lib/utils/playbook-formation"
import {
  getDisplayLabel,
  getPlayerForSlot,
  getRoleLabelsForPlayer,
  getSameUnitRoleLabelsForPlayer,
  type DepthChartSlot,
} from "@/lib/constants/playbook-positions"
import type { PlayRecord, FormationRecord } from "@/types/playbook"

/** Selected marker: label is derived from positionCode+positionNumber when positionCode is set (read-only). */
export interface InspectorSelectedPlayer {
  id: string
  label: string
  shape: string
  positionCode?: string | null
  positionNumber?: number | null
  hasDuplicateRole?: boolean
}

export type RosterPlayerForAssign = {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup?: string | null
}

function formatPlayerLabel(p: RosterPlayerForAssign, suffix = ""): string {
  const jersey = p.jerseyNumber != null ? `#${p.jerseyNumber}` : ""
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ")
  const base = [jersey, name].filter(Boolean).join(" ").trim() || p.id
  return suffix ? `${base} ${suffix}` : base
}

/** True if roster positionGroup is a reasonable match for playbook positionCode (e.g. WR, OLB). */
function positionMatchesRole(positionGroup: string | null | undefined, positionCode: string): boolean {
  if (!positionGroup?.trim()) return false
  const g = positionGroup.trim().toUpperCase()
  const c = positionCode.trim().toUpperCase()
  return g === c || g.startsWith(c) || c.startsWith(g) || g.includes(c) || c.includes(g)
}

function AssignToControl({
  playSide,
  positionCode,
  positionNumber,
  currentPlayerId,
  rosterPlayers,
  depthChartEntries,
  hasDuplicateRole,
  onAssign,
}: {
  playSide: string
  positionCode: string
  positionNumber: number
  currentPlayerId: string
  rosterPlayers: RosterPlayerForAssign[]
  depthChartEntries: DepthChartSlot[]
  hasDuplicateRole: boolean
  onAssign: (unit: string, position: string, stringNum: number, playerId: string | null) => Promise<boolean>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedRoster = [...rosterPlayers].sort((a, b) => {
    const aMatch = positionMatchesRole(a.positionGroup, positionCode)
    const bMatch = positionMatchesRole(b.positionGroup, positionCode)
    if (aMatch && !bMatch) return -1
    if (!aMatch && bMatch) return 1
    const aLast = (a.lastName || a.firstName || "").toLowerCase()
    const bLast = (b.lastName || b.firstName || "").toLowerCase()
    if (aLast !== bLast) return aLast.localeCompare(bLast)
    return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase())
  })

  const currentRoles = currentPlayerId
    ? getRoleLabelsForPlayer(depthChartEntries, currentPlayerId)
    : []
  const sameUnitOtherRoles = currentPlayerId
    ? getSameUnitRoleLabelsForPlayer(depthChartEntries, currentPlayerId, playSide, positionCode, positionNumber)
    : []
  const currentRosterPlayer = rosterPlayers.find((p) => p.id === currentPlayerId)
  const positionMismatch =
    currentRosterPlayer?.positionGroup &&
    !positionMatchesRole(currentRosterPlayer.positionGroup, positionCode)

  const handleChange = async (value: string) => {
    const playerId = value || null
    const replacing = currentPlayerId && playerId && playerId !== currentPlayerId
    const newPlayer = playerId ? rosterPlayers.find((p) => p.id === playerId) : null
    const newPlayerSameUnitRoles =
      newPlayer && playerId ? getSameUnitRoleLabelsForPlayer(depthChartEntries, playerId, playSide) : []

    if (replacing && currentRosterPlayer && newPlayer) {
      const confirmMsg = newPlayerSameUnitRoles.length
        ? `Replace ${formatPlayerLabel(currentRosterPlayer)} with ${formatPlayerLabel(newPlayer)}? This player already has: ${newPlayerSameUnitRoles.join(", ")}.`
        : `Replace ${formatPlayerLabel(currentRosterPlayer)} with ${formatPlayerLabel(newPlayer)}?`
      if (!confirm(confirmMsg)) return
    }

    setError(null)
    setSaving(true)
    try {
      const ok = await onAssign(playSide, positionCode, positionNumber, playerId)
      if (!ok) setError("Could not update depth chart. You may need roster edit permission.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-500">Assign to</Label>
      <div className="flex flex-col gap-1.5">
        <select
          value={currentPlayerId}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-sm text-slate-800 disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          {sortedRoster.map((p) => (
            <option key={p.id} value={p.id}>
              {formatPlayerLabel(p, p.id === currentPlayerId ? "(current)" : "")}
            </option>
          ))}
        </select>
        {currentPlayerId && currentRoles.length > 0 && (
          <p className="text-xs text-slate-500">
            Current roles: <span className="text-slate-700">{currentRoles.join(", ")}</span>
          </p>
        )}
        {hasDuplicateRole && (
          <p className="text-xs text-amber-600" title="Another marker has the same role label on this play">
            Duplicate role on this play — two markers share this role label.
          </p>
        )}
        {sameUnitOtherRoles.length > 0 && (
          <p className="text-xs text-amber-600">
            This player also has in this unit: <span className="font-medium">{sameUnitOtherRoles.join(", ")}</span>
          </p>
        )}
        {positionMismatch && currentRosterPlayer && (
          <p className="text-xs text-amber-600">
            Roster position (<span className="font-medium">{currentRosterPlayer.positionGroup}</span>) may not match
            role (<span className="font-medium">{positionCode}</span>).
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

interface PlaybookInspectorProps {
  play: PlayRecord | null
  formations?: FormationRecord[] | null
  depthChartEntries?: DepthChartSlot[] | null
  /** Roster players for "Assign to" dropdown when assigning a role from the inspector. */
  rosterPlayers?: RosterPlayerForAssign[] | null
  /** Callback to set/clear the depth chart slot for (unit, position, string). Updates depth chart only. */
  onAssignSlot?: (unit: string, position: string, stringNum: number, playerId: string | null) => Promise<boolean>
  selectedObject: "play" | "player" | "zone" | "route" | null
  selectedPlayer?: InspectorSelectedPlayer | null
  selectedZone?: { id: string; type: string; size: string } | null
  onPlayNameChange?: (name: string) => void
  onPlayerLabelChange?: (playerId: string, label: string) => void
  canEdit: boolean
}

export function PlaybookInspector({
  play,
  formations,
  depthChartEntries,
  rosterPlayers,
  onAssignSlot,
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

        {selectedObject === "player" && selectedPlayer && (
          <div className="space-y-2">
            {selectedPlayer.positionCode != null && selectedPlayer.positionCode !== "" ? (
              <>
                <Label className="text-xs text-slate-500">Role</Label>
                <p className="text-sm font-medium text-slate-800">
                  {getDisplayLabel(selectedPlayer.positionCode, selectedPlayer.positionNumber)}
                </p>
                <p className="text-xs text-slate-500">Position: {selectedPlayer.positionCode}</p>
                {selectedPlayer.positionNumber != null && (
                  <p className="text-xs text-slate-500">Number: {selectedPlayer.positionNumber}</p>
                )}
                {play && depthChartEntries?.length ? (
                  (() => {
                    const slotNum = selectedPlayer.positionNumber ?? 1
                    const assigned = getPlayerForSlot(
                      depthChartEntries,
                      play.side,
                      selectedPlayer.positionCode!,
                      slotNum
                    )
                    return (
                      <p className="text-xs text-slate-500">
                        Assigned:{" "}
                        {assigned ? (
                          <span className="text-slate-800">
                            {assigned.jerseyNumber != null ? `#${assigned.jerseyNumber} ` : ""}
                            {[assigned.firstName, assigned.lastName].filter(Boolean).join(" ") || "—"}
                          </span>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </p>
                    )
                  })()
                ) : null}
                {play && canEdit && onAssignSlot && rosterPlayers && (
                  <AssignToControl
                    playSide={play.side}
                    positionCode={selectedPlayer.positionCode!}
                    positionNumber={selectedPlayer.positionNumber ?? 1}
                    currentPlayerId={(() => {
                      const slotNum = selectedPlayer.positionNumber ?? 1
                      const a = getPlayerForSlot(
                        depthChartEntries ?? [],
                        play.side,
                        selectedPlayer.positionCode!,
                        slotNum
                      )
                      return a?.id ?? ""
                    })()}
                    rosterPlayers={rosterPlayers}
                    depthChartEntries={depthChartEntries ?? []}
                    hasDuplicateRole={!!selectedPlayer.hasDuplicateRole}
                    onAssign={onAssignSlot}
                  />
                )}
                <p className="text-xs text-slate-500">Shape: {selectedPlayer.shape}</p>
                {!rosterPlayers?.length && selectedPlayer.hasDuplicateRole && (
                  <p className="text-xs text-amber-600" title="Another marker has the same role label on this play">
                    Duplicate role on this play
                  </p>
                )}
              </>
            ) : (
              <>
                <Label className="text-xs text-slate-500">Player label</Label>
                {canEdit && onPlayerLabelChange ? (
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
              </>
            )}
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
