"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import type { PlayerProfile } from "@/types/player-profile"

interface PlayerProfilePracticeMetricsFormProps {
  profile: PlayerProfile
  editDraft: Partial<PlayerProfile>
  setEditDraft: (d: Partial<PlayerProfile> | ((prev: Partial<PlayerProfile>) => Partial<PlayerProfile>)) => void
  value: (k: keyof PlayerProfile) => unknown
}

/** Coach-editable practice / measurables only (not season or game stat lines — those live in weekly entries). */
export function PlayerProfilePracticeMetricsForm({
  profile,
  editDraft,
  setEditDraft,
  value,
}: PlayerProfilePracticeMetricsFormProps) {
  const practiceMetrics =
    (value("practiceMetrics") as Record<string, unknown>) ??
    (profile.practiceMetrics && typeof profile.practiceMetrics === "object"
      ? (profile.practiceMetrics as Record<string, unknown>)
      : {})

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

  return (
    <div className="space-y-3">
      <Label className="text-foreground font-medium">Practice / performance metrics</Label>
      <p className="text-xs text-muted-foreground">
        Custom measurables (e.g. 40 time, bench). Season and game stats are managed as weekly lines above.
      </p>
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-red-600"
              onClick={() => removePracticeMetric(key)}
              aria-label="Remove metric"
            >
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
  )
}
