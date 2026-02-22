"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Save } from "lucide-react"

interface CalendarSettingsData {
  id?: string
  defaultView: string
  practiceColor: string
  gameColor: string
  meetingColor: string
  customColor: string
  assistantsCanAddMeetings: boolean
  assistantsCanAddPractices: boolean
  assistantsCanEditNonlocked: boolean
  compactView: boolean
}

interface CalendarSettingsProps {
  teamId: string
  initialSettings: CalendarSettingsData | null
}

export function CalendarSettings({ teamId, initialSettings }: CalendarSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<CalendarSettingsData>(
    initialSettings || {
      defaultView: "week",
      practiceColor: "#22C55E", // Green - Practice/Positive
      gameColor: "#1e3a5f", // Deep navy - Games/Primary UI
      meetingColor: "#475569", // Slate - Neutral
      customColor: "#334155", // Slate - Neutral
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar Settings
        </CardTitle>
        <CardDescription>
          Configure calendar appearance and assistant permissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default View */}
        <div className="space-y-2">
          <Label htmlFor="defaultView">Default Calendar View</Label>
          <select
            id="defaultView"
            value={settings.defaultView}
            onChange={(e) => setSettings({ ...settings, defaultView: e.target.value })}
            className="flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-[#0F172A]"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>

        {/* Event Colors */}
        <div className="space-y-4">
          <Label>Event Type Colors</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="practiceColor" className="text-sm">
                Practice Color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="practiceColor"
                  type="color"
                  value={settings.practiceColor}
                  onChange={(e) => setSettings({ ...settings, practiceColor: e.target.value })}
                  className="h-10 w-20"
                />
                <Input
                  type="text"
                  value={settings.practiceColor}
                  onChange={(e) => setSettings({ ...settings, practiceColor: e.target.value })}
                  className="flex-1"
                  placeholder="#1e3a5f"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gameColor" className="text-sm">
                Game Color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="gameColor"
                  type="color"
                  value={settings.gameColor}
                  onChange={(e) => setSettings({ ...settings, gameColor: e.target.value })}
                  className="h-10 w-20"
                />
                <Input
                  type="text"
                  value={settings.gameColor}
                  onChange={(e) => setSettings({ ...settings, gameColor: e.target.value })}
                  className="flex-1"
                  placeholder="#1e3a5f"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meetingColor" className="text-sm">
                Meeting Color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="meetingColor"
                  type="color"
                  value={settings.meetingColor}
                  onChange={(e) => setSettings({ ...settings, meetingColor: e.target.value })}
                  className="h-10 w-20"
                />
                <Input
                  type="text"
                  value={settings.meetingColor}
                  onChange={(e) => setSettings({ ...settings, meetingColor: e.target.value })}
                  className="flex-1"
                  placeholder="#475569"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customColor" className="text-sm">
                Custom Event Color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="customColor"
                  type="color"
                  value={settings.customColor}
                  onChange={(e) => setSettings({ ...settings, customColor: e.target.value })}
                  className="h-10 w-20"
                />
                <Input
                  type="text"
                  value={settings.customColor}
                  onChange={(e) => setSettings({ ...settings, customColor: e.target.value })}
                  className="flex-1"
                  placeholder="#334155"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Assistant Permissions */}
        <div className="space-y-4 border-t pt-4">
          <Label>Assistant Coach Permissions</Label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.assistantsCanAddMeetings}
                onChange={(e) =>
                  setSettings({ ...settings, assistantsCanAddMeetings: e.target.checked })
                }
                className="h-4 w-4"
              />
              <span className="text-sm text-[#0F172A]">Assistants can add meetings</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.assistantsCanAddPractices}
                onChange={(e) =>
                  setSettings({ ...settings, assistantsCanAddPractices: e.target.checked })
                }
                className="h-4 w-4"
              />
              <span className="text-sm text-[#0F172A]">Assistants can add practices</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.assistantsCanEditNonlocked}
                onChange={(e) =>
                  setSettings({ ...settings, assistantsCanEditNonlocked: e.target.checked })
                }
                className="h-4 w-4"
              />
              <span className="text-sm text-[#0F172A]">Assistants can edit non-locked events</span>
            </label>
          </div>
        </div>

        {/* Appearance */}
        <div className="space-y-4 border-t pt-4">
          <Label>Appearance</Label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.compactView}
              onChange={(e) => setSettings({ ...settings, compactView: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm text-[#0F172A]">Use compact calendar view</span>
          </label>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
