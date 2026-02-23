"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save } from "lucide-react"

interface CalendarSettingsData {
  id?: string
  defaultView: string
  assistantsCanAddMeetings: boolean
  assistantsCanAddPractices: boolean
  assistantsCanEditNonlocked: boolean
  compactView: boolean
}

interface CalendarSettingsSectionProps {
  teamId: string
  initialSettings: CalendarSettingsData | null
}

export function CalendarSettingsSection({ teamId, initialSettings }: CalendarSettingsSectionProps) {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<CalendarSettingsData>(
    initialSettings || {
      defaultView: "week",
      assistantsCanAddMeetings: true,
      assistantsCanAddPractices: false,
      assistantsCanEditNonlocked: false,
      compactView: false,
    }
  )

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/calendar/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save settings")
      }

      alert("Calendar settings saved successfully!")
    } catch (error: any) {
      alert(error.message || "Error saving settings")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Calendar View Settings</CardTitle>
          <CardDescription className="text-white/70">
            Configure default calendar view and appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default View */}
          <div className="space-y-2">
            <Label htmlFor="defaultView" className="text-white">Default Calendar View</Label>
            <select
              id="defaultView"
              value={settings.defaultView}
              onChange={(e) => setSettings({ ...settings, defaultView: e.target.value })}
              className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>

          {/* Appearance */}
          <div className="space-y-4 border-t border-white/10 pt-4">
            <Label className="text-white">Appearance</Label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.compactView}
                onChange={(e) => setSettings({ ...settings, compactView: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm text-white">Use compact calendar view</span>
            </label>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/10">
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
