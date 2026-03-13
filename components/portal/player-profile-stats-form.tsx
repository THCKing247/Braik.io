"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import type { PlayerProfile } from "@/types/player-profile"

const SEASON_STAT_KEYS = [
  { key: "games_played", label: "Games played" },
  { key: "passing_yards", label: "Passing yards" },
  { key: "rushing_yards", label: "Rushing yards" },
  { key: "receptions", label: "Receptions" },
  { key: "receiving_yards", label: "Receiving yards" },
  { key: "touchdowns", label: "Touchdowns" },
  { key: "tackles", label: "Tackles" },
  { key: "interceptions", label: "Interceptions" },
]

interface PlayerProfileStatsFormProps {
  profile: PlayerProfile
  editDraft: Partial<PlayerProfile>
  setEditDraft: (d: Partial<PlayerProfile> | ((prev: Partial<PlayerProfile>) => Partial<PlayerProfile>)) => void
  value: (k: keyof PlayerProfile) => unknown
}

export function PlayerProfileStatsForm({
  profile,
  editDraft,
  setEditDraft,
  value,
}: PlayerProfileStatsFormProps) {
  const seasonStats = (value("seasonStats") as Record<string, unknown>) ?? (profile.seasonStats && typeof profile.seasonStats === "object" ? (profile.seasonStats as Record<string, unknown>) : {})
  const gameStats = (value("gameStats") as unknown[]) ?? (Array.isArray(profile.gameStats) ? profile.gameStats : [])
  const practiceMetrics = (value("practiceMetrics") as Record<string, unknown>) ?? (profile.practiceMetrics && typeof profile.practiceMetrics === "object" ? (profile.practiceMetrics as Record<string, unknown>) : {})

  const updateSeasonStat = (key: string, val: string) => {
    const next = { ...seasonStats }
    if (val === "" || val == null) delete next[key]
    else next[key] = val
    setEditDraft((p) => ({ ...p, seasonStats: next }))
  }

  const addCustomSeasonStat = () => {
    const key = `custom_${Date.now()}`
    setEditDraft((p) => ({ ...p, seasonStats: { ...seasonStats, [key]: "" } }))
  }

  const removeSeasonStat = (key: string) => {
    const next = { ...seasonStats }
    delete next[key]
    setEditDraft((p) => ({ ...p, seasonStats: next }))
  }

  const addGame = () => {
    const newGame = { date: "", opponent: "", notes: "" }
    setEditDraft((p) => ({ ...p, gameStats: [...gameStats, newGame] }))
  }

  const updateGame = (index: number, field: string, val: string) => {
    const next = [...gameStats]
    const g = (next[index] as Record<string, unknown>) ?? {}
    next[index] = { ...g, [field]: val }
    setEditDraft((p) => ({ ...p, gameStats: next }))
  }

  const removeGame = (index: number) => {
    setEditDraft((p) => ({ ...p, gameStats: gameStats.filter((_, i) => i !== index) }))
  }

  const updatePracticeMetric = (key: string, val: string) => {
    const next = { ...practiceMetrics }
    if (val === "" || val == null) delete next[key]
    else next[key] = val
    setEditDraft((p) => ({ ...p, practiceMetrics: next }))
  }

  const addPracticeMetric = () => {
    const key = `metric_${Date.now()}`
    setEditDraft((p) => ({ ...p, practiceMetrics: { ...practiceMetrics, [key]: "" } }))
  }

  const removePracticeMetric = (key: string) => {
    const next = { ...practiceMetrics }
    delete next[key]
    setEditDraft((p) => ({ ...p, practiceMetrics: next }))
  }

  const customSeasonKeys = Object.keys(seasonStats).filter((k) => !SEASON_STAT_KEYS.some((s) => s.key === k))

  return (
    <div className="space-y-8">
      {/* Season stats */}
      <div className="space-y-3">
        <Label className="text-[#0F172A] font-medium">Season stats</Label>
        <p className="text-xs text-[#64748B]">Common stats for the season. Add custom fields as needed.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SEASON_STAT_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Label className="w-32 shrink-0 text-sm text-[#64748B]">{label}</Label>
              <Input
                type="text"
                value={String(seasonStats[key] ?? "")}
                onChange={(e) => updateSeasonStat(key, e.target.value)}
                placeholder="—"
                className="flex-1"
              />
            </div>
          ))}
          {customSeasonKeys.map((key) => (
            <div key={key} className="flex items-center gap-2 sm:col-span-2">
              <Input
                type="text"
                value={key.startsWith("custom_") ? "" : key}
                placeholder="Stat name"
                className="w-32 shrink-0"
                readOnly={key.startsWith("custom_")}
              />
              <Input
                type="text"
                value={String(seasonStats[key] ?? "")}
                onChange={(e) => updateSeasonStat(key, e.target.value)}
                placeholder="Value"
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-red-600" onClick={() => removeSeasonStat(key)} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addCustomSeasonStat}>
          <Plus className="h-4 w-4 mr-1" />
          Add custom stat
        </Button>
      </div>

      {/* Game stats */}
      <div className="space-y-3">
        <Label className="text-[#0F172A] font-medium">Game-by-game</Label>
        <p className="text-xs text-[#64748B]">Add individual game entries. Use notes for stat lines.</p>
        <div className="space-y-4">
          {gameStats.map((g, i) => (
            <div key={i} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-[#64748B]">Game {i + 1}</span>
                <Button type="button" variant="ghost" size="sm" className="text-red-600 h-8" onClick={() => removeGame(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-[#64748B]">Date</Label>
                  <Input
                    value={String((g as Record<string, unknown>)?.date ?? "")}
                    onChange={(e) => updateGame(i, "date", e.target.value)}
                    placeholder="e.g. 2024-09-15"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#64748B]">Opponent</Label>
                  <Input
                    value={String((g as Record<string, unknown>)?.opponent ?? "")}
                    onChange={(e) => updateGame(i, "opponent", e.target.value)}
                    placeholder="Opponent name"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-[#64748B]">Notes / stats line</Label>
                <Input
                  value={String((g as Record<string, unknown>)?.notes ?? "")}
                  onChange={(e) => updateGame(i, "notes", e.target.value)}
                  placeholder="e.g. 12/18, 145 yds, 2 TD"
                />
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addGame}>
          <Plus className="h-4 w-4 mr-1" />
          Add game
        </Button>
      </div>

      {/* Practice / performance metrics */}
      <div className="space-y-3">
        <Label className="text-[#0F172A] font-medium">Practice / performance metrics</Label>
        <p className="text-xs text-[#64748B]">Custom key-value metrics (e.g. 40-yard time, bench reps).</p>
        <div className="space-y-2">
          {Object.entries(practiceMetrics).map(([key, v]) => (
            <div key={key} className="flex items-center gap-2">
              <Input
                type="text"
                value={key.startsWith("metric_") ? "" : key}
                placeholder="Metric name"
                className="w-40 shrink-0"
                readOnly={key.startsWith("metric_")}
              />
              <Input
                type="text"
                value={String(v ?? "")}
                onChange={(e) => updatePracticeMetric(key, e.target.value)}
                placeholder="Value"
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-red-600" onClick={() => removePracticeMetric(key)} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPracticeMetric}>
          <Plus className="h-4 w-4 mr-1" />
          Add metric
        </Button>
      </div>
    </div>
  )
}
