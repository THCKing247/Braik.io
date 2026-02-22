"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, X } from "lucide-react"

interface PositionLabel {
  unit: string
  position: string
  customLabel: string
  specialTeamType?: string | null
}

interface PositionLabelEditorProps {
  teamId: string
  unit: "offense" | "defense" | "special_teams"
  positions: Array<{ position: string; label: string }>
  specialTeamType?: string | null
  onLabelsUpdated?: () => void
}

export function PositionLabelEditor({
  teamId,
  unit,
  positions,
  specialTeamType,
  onLabelsUpdated,
}: PositionLabelEditorProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [labels, setLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      loadLabels()
    }
  }, [open, teamId, unit, specialTeamType])

  const loadLabels = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/roster/depth-chart/position-labels?teamId=${teamId}`)
      if (response.ok) {
        const data = await response.json()
        setLabels(data.labels || {})
      }
    } catch (error) {
      console.error("Failed to load labels:", error)
    } finally {
      setLoading(false)
    }
  }

  const getLabelKey = (position: string) => {
    return specialTeamType
      ? `${unit}-${position}-${specialTeamType}`
      : `${unit}-${position}`
  }

  const handleLabelChange = (position: string, value: string) => {
    const key = getLabelKey(position)
    setLabels((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const labelUpdates = positions.map((pos) => ({
        unit,
        position: pos.position,
        customLabel: labels[getLabelKey(pos.position)] || pos.label,
        specialTeamType: specialTeamType || null,
      }))

      const response = await fetch("/api/roster/depth-chart/position-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          labels: labelUpdates,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save labels")
      }

      setOpen(false)
      if (onLabelsUpdated) {
        onLabelsUpdated()
      }
    } catch (error: any) {
      alert(error.message || "Error saving labels")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {!open ? (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" />
          Edit Position Labels
        </Button>
      ) : (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Edit Position Labels - {unit.charAt(0).toUpperCase() + unit.slice(1)}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-8 text-center">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    {positions.map((pos) => {
                      const key = getLabelKey(pos.position)
                      const currentLabel = labels[key] || pos.label
                      return (
                        <div key={pos.position} className="space-y-2">
                          <Label htmlFor={`label-${pos.position}`}>
                            {pos.position} (Position Key)
                          </Label>
                          <Input
                            id={`label-${pos.position}`}
                            value={currentLabel}
                            onChange={(e) => handleLabelChange(pos.position, e.target.value)}
                            placeholder={pos.label}
                          />
                        </div>
                      )
                    })}
                    <div className="flex gap-4 pt-4">
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save Labels"}
                      </Button>
                      <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
