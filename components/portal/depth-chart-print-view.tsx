"use client"

import type { DepthAssignment, FormationSlot } from "@/lib/depth-chart/formation-presets"

export interface PrintViewPlayer {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
}

interface DepthChartPrintViewProps {
  teamName?: string | null
  unitLabel: string
  formationName: string
  generatedDate: string
  slots: FormationSlot[]
  assignments: DepthAssignment[]
  playersById: Map<string, PrintViewPlayer>
}

function formatPlayerLine(player: PrintViewPlayer): string {
  const num = player.jerseyNumber != null ? `#${player.jerseyNumber}` : ""
  const initial = (player.firstName ?? "").trim()[0] ?? ""
  const last = (player.lastName ?? "").trim() || "—"
  const name = initial ? `${initial}. ${last}` : last
  return num ? `${num} ${name}` : name
}

export function DepthChartPrintView({
  teamName,
  unitLabel,
  formationName,
  generatedDate,
  slots,
  assignments,
  playersById,
}: DepthChartPrintViewProps) {
  const getPlayersForSlot = (slotKey: string) => {
    return (
      assignments
        .filter((e) => e.position === slotKey && e.playerId != null)
        .map((e) => ({ string: e.string, player: playersById.get(e.playerId!) }))
        .filter((x) => x.player != null)
        .sort((a, b) => a.string - b.string) as Array<{ string: number; player: PrintViewPlayer }>
    )
  }

  return (
    <div className="depth-chart-print-root bg-white text-black p-6 max-w-4xl">
      <header className="border-b border-slate-300 pb-3 mb-4">
        {teamName && (
          <h1 className="text-lg font-bold text-slate-900 mb-1">{teamName}</h1>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
          <span className="font-semibold">{unitLabel}</span>
          <span>{formationName}</span>
          <span>Generated {generatedDate}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 print:grid-cols-3">
        {slots.map((slot) => {
          const rows = getPlayersForSlot(slot.slotKey)
          const one = rows.find((r) => r.string === 1)?.player
          const two = rows.find((r) => r.string === 2)?.player
          const three = rows.find((r) => r.string === 3)?.player
          return (
            <div
              key={slot.slotKey}
              className="border border-slate-200 rounded p-3 print:break-inside-avoid"
            >
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
                {slot.displayLabel}
              </div>
              <ol className="text-sm text-slate-900 space-y-1 list-decimal list-inside">
                <li>{one ? formatPlayerLine(one) : "Open"}</li>
                <li>{two ? formatPlayerLine(two) : "—"}</li>
                <li>{three ? formatPlayerLine(three) : "—"}</li>
              </ol>
            </div>
          )
        })}
      </div>
    </div>
  )
}
