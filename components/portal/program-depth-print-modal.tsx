"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { ProgramDepthChartLevel } from "./program-depth-chart-view"

type ProgramDepthPrintModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  levels: ProgramDepthChartLevel[]
  selectedUnit: "offense" | "defense" | "special_teams"
}

export function ProgramDepthPrintModal({
  open,
  onOpenChange,
  levels,
  selectedUnit,
}: ProgramDepthPrintModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(levels.map((l) => l.teamId)))
  const [printEmpty, setPrintEmpty] = useState(false)
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait")

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const print = () => {
    const w = window.open("", "_blank", "noopener,noreferrer")
    if (!w) return
    const include = levels.filter((l) => selectedIds.has(l.teamId))
    const unitLabel =
      selectedUnit === "special_teams" ? "Special teams" : selectedUnit.charAt(0).toUpperCase() + selectedUnit.slice(1)

    const sectionHtml = include
      .map((level) => {
        const byPos = new Map<string, typeof level.entries>()
        for (const e of level.entries) {
          if (e.unit !== selectedUnit) continue
          const list = byPos.get(e.position) ?? []
          list.push(e)
          byPos.set(e.position, list)
        }
        for (const list of byPos.values()) {
          list.sort((a, b) => a.string - b.string)
        }
        const positions = Array.from(byPos.keys()).sort()
        const rows = positions
          .map((position) => {
            const list = byPos.get(position) ?? []
            const slots = list.filter((e) => e.playerId || printEmpty)
            if (slots.length === 0 && !printEmpty) return ""
            const cells = slots
              .sort((a, b) => a.string - b.string)
              .map((e) => {
                const name = e.player
                  ? `${e.player.firstName} ${e.player.lastName}${e.player.jerseyNumber != null ? ` #${e.player.jerseyNumber}` : ""}`
                  : "—"
                return `<span class="slot">${e.string}. ${escapeHtml(name)}</span>`
              })
              .join(" ")
            return `<div class="pos-row"><span class="pos">${escapeHtml(position)}</span><span class="names">${cells || "—"}</span></div>`
          })
          .filter(Boolean)
          .join("")
        if (!rows) return ""
        return `<section class="level"><h2>${escapeHtml(levelLabel(level.teamLevel))} — ${escapeHtml(level.teamName)}</h2><div class="unit">${escapeHtml(unitLabel)}</div>${rows}</section>`
      })
      .filter(Boolean)
      .join("")

    const styles = `@page { size: ${orientation}; margin: 0.6in; }
      body { font-family: system-ui, Segoe UI, sans-serif; color: #0f172a; font-size: 11pt; }
      h1 { font-size: 16pt; margin: 0 0 12pt; }
      h2 { font-size: 12pt; margin: 16pt 0 8pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 4pt; }
      .unit { font-size: 10pt; color: #64748b; margin-bottom: 8pt; }
      .pos-row { display: flex; gap: 12pt; margin: 4pt 0; flex-wrap: wrap; page-break-inside: avoid; }
      .pos { flex: 0 0 5rem; font-weight: 600; color: #475569; }
      .names { flex: 1; min-width: 0; }
      .slot { margin-right: 12pt; }
      .brand { font-size: 9pt; color: #64748b; margin-top: 20pt; text-align: center; }`

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Program depth — ${escapeHtml(unitLabel)}</title><style>${styles}</style></head><body>
      <h1>Program depth chart</h1>
      ${sectionHtml || "<p>No positions to print for this unit.</p>"}
      <p class="brand">Braik</p>
      <script>window.onload = function() { window.print(); window.close(); }</script>
    </body></html>`)
    w.document.close()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Print program depth</DialogTitle>
          <DialogDescription>
            Choose which team levels to include. Output opens in a print dialog; use your browser print settings for paper and margins.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm">Sections (team levels)</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {levels.map((l) => (
                <label key={l.teamId} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(l.teamId)}
                    onChange={() => toggle(l.teamId)}
                    className="rounded border-border"
                  />
                  <span>
                    {levelLabel(l.teamLevel)} — {l.teamName}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(new Set(levels.map((l) => l.teamId)))}>
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={printEmpty}
              onChange={(e) => setPrintEmpty(e.target.checked)}
              className="rounded border-border"
            />
            Include empty position slots (—)
          </label>
          <div className="space-y-1">
            <Label className="text-sm">Orientation</Label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as "portrait" | "landscape")}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            The current tab ({selectedUnit === "special_teams" ? "Special teams" : selectedUnit}) is what will print for each selected section.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={print} disabled={selectedIds.size === 0}>
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function levelLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
