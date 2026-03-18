"use client"

import React from "react"
import Image from "next/image"
import type { FormationPreset, FormationRow, FormationSlot, RowAlignment } from "@/lib/depth-chart/formation-presets"
import { getPlayerPhotoUrl, type RosterPlayerForSlot } from "@/lib/depth-chart/player-resolve"

export interface SlotPosition {
  slotKey: string
  displayLabel: string
  alias?: string | null
  top: number
  left: number
  isQB: boolean
  slot: FormationSlot
}

/** Map preset rows to percentage positions (top, left) for field layout. */
export function getSlotPositions(preset: FormationPreset): SlotPosition[] {
  const rows = preset.rows?.length
    ? preset.rows
    : (() => {
        const slots = preset.slots ?? []
        if (slots.length === 0) return []
        return [{ alignment: "center" as RowAlignment, slots }]
      })()

  if (rows.length === 0) return []

  const result: SlotPosition[] = []
  const rowCount = rows.length
  const verticalPadding = 10
  const verticalRange = 80
  const rowStep = rowCount > 1 ? verticalRange / (rowCount - 1) : 0

  rows.forEach((row: FormationRow, rowIndex: number) => {
    const top = verticalPadding + (rowIndex * rowStep)
    const slots = row.slots ?? []
    const n = slots.length
    const alignment = row.alignment ?? "center"

    slots.forEach((slot: FormationSlot, slotIndex: number) => {
      let left: number
      if (alignment === "spread") {
        left = ((slotIndex + 1) / (n + 1)) * 100
      } else if (alignment === "center") {
        const half = (n - 1) / 2
        const offset = (slotIndex - half) * 16
        left = 50 + offset
      } else if (alignment === "left") {
        left = 15 + slotIndex * 18
      } else {
        left = 85 - (n - 1 - slotIndex) * 18
      }
      left = Math.max(8, Math.min(92, left))
      const isQB = slot.slotKey === "QB"
      result.push({
        slotKey: slot.slotKey,
        displayLabel: slot.displayLabel,
        alias: slot.alias,
        top,
        left,
        isQB,
        slot,
      })
    })
  })

  return result
}

function getInitials(first: string, last: string) {
  return `${(first ?? "")[0] ?? ""}${(last ?? "")[0] ?? ""}`.toUpperCase() || "?"
}

interface FieldSlotProps {
  position: SlotPosition
  player: RosterPlayerForSlot | null
  isSelected: boolean
  canEdit: boolean
  onTap: () => void
}

function FieldSlot({ position, player, isSelected, canEdit, onTap }: FieldSlotProps) {
  const isQB = position.isQB

  return (
    <button
      type="button"
      onClick={onTap}
      className={`
        absolute flex flex-col items-center justify-center rounded-full
        transition-all duration-[200ms] ease-out
        ${isQB ? "h-16 w-16 min-h-[64px] min-w-[64px] md:h-[72px] md:w-[72px] md:min-h-[72px] md:min-w-[72px] shadow-lg" : "h-14 w-14 min-h-[56px] min-w-[56px] md:h-16 md:w-16 md:min-h-[64px] md:min-w-[64px] shadow-md"}
        ${player
          ? "border-2 border-white bg-white/95 text-foreground ring-2 ring-black/10"
          : "border-2 border-dashed border-white/50 bg-white/10 text-white/90"
        }
        ${isSelected ? "ring-4 ring-primary ring-offset-2 ring-offset-[#1a2e1a] scale-110 z-10 shadow-lg" : ""}
        ${!player && canEdit ? "hover:border-primary/70 hover:bg-primary/20 hover:scale-105" : ""}
        ${player && canEdit ? "hover:ring-primary/50 active:scale-95" : ""}
      `}
      style={{
        top: `${position.top}%`,
        left: `${position.left}%`,
        transform: "translate(-50%, -50%)",
      }}
      aria-label={player ? `${position.displayLabel}: ${player.firstName} ${player.lastName}` : `${position.displayLabel}: empty`}
    >
      {player ? (
        <>
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-black/5">
            {getPlayerPhotoUrl(player) ? (
              <Image
                src={getPlayerPhotoUrl(player)!}
                alt=""
                fill
                className="object-cover"
                sizes="32px"
                unoptimized
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                {getInitials(player.firstName, player.lastName)}
              </span>
            )}
          </div>
          <span className="mt-0.5 text-[9px] font-bold tabular-nums leading-tight md:text-[10px]">
            #{player.jerseyNumber ?? "—"}
          </span>
          <span className="text-[8px] font-medium text-muted-foreground leading-tight md:text-[9px]">
            {position.displayLabel}
          </span>
        </>
      ) : (
        <>
          <span className="text-[10px] font-semibold leading-tight md:text-xs">
            {position.displayLabel}
          </span>
          {position.alias && (
            <span className="text-[8px] opacity-80 md:text-[9px]">({position.alias})</span>
          )}
        </>
      )}
    </button>
  )
}

export interface FormationFieldViewProps {
  preset: FormationPreset
  getResolvedPlayersForSlot: (slotKey: string) => Array<{ player: RosterPlayerForSlot; string: number }>
  selectedSlotKey: string | null
  canEdit: boolean
  onTapEmpty: (slotKey: string, string: number, label: string) => void
  onTapFilled: (slotKey: string, string: number, label: string, player: RosterPlayerForSlot) => void
  /** When true, use structured list fallback instead of field. */
  useFallbackLayout?: boolean
}

export function FormationFieldView({
  preset,
  getResolvedPlayersForSlot,
  selectedSlotKey,
  canEdit,
  onTapEmpty,
  onTapFilled,
  useFallbackLayout = false,
}: FormationFieldViewProps) {
  const positions = React.useMemo(() => getSlotPositions(preset), [preset])

  if (useFallbackLayout || positions.length === 0) {
    return null
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl shadow-xl"
      style={{
        aspectRatio: "3/4",
        maxHeight: "min(500px, 70vh)",
        background: "linear-gradient(180deg, #0d2818 0%, #1a3d2a 35%, #1e4620 70%, #163020 100%)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.2)",
      }}
    >
      {/* Optional very subtle yard-line stripes */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(255,255,255,0.5) 24px, rgba(255,255,255,0.5) 25px)",
        }}
      />
      <div className="relative h-full w-full p-2 md:p-3">
        {positions.map((pos) => {
          const resolved = getResolvedPlayersForSlot(pos.slotKey)
          const starter = resolved.find((r) => r.string === 1)?.player ?? null
          const label = pos.displayLabel + (pos.alias ? ` (${pos.alias})` : "")
          return (
            <FieldSlot
              key={pos.slotKey}
              position={pos}
              player={starter}
              isSelected={selectedSlotKey === pos.slotKey}
              canEdit={canEdit}
              onTap={() => {
                if (starter) {
                  onTapFilled(pos.slotKey, 1, label, starter)
                } else if (canEdit) {
                  onTapEmpty(pos.slotKey, 1, label)
                }
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
