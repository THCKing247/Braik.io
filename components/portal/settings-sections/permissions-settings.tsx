"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Save } from "lucide-react"

interface CalendarSettingsData {
  id?: string
  assistantsCanAddMeetings: boolean
  assistantsCanAddPractices: boolean
  assistantsCanEditNonlocked: boolean
}

interface PermissionsSettingsProps {
  teamId: string
  initialSettings: CalendarSettingsData | null
}

export function PermissionsSettings({ teamId, initialSettings }: PermissionsSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<CalendarSettingsData>(
    initialSettings || {
      assistantsCanAddMeetings: true,
      assistantsCanAddPractices: false,
      assistantsCanEditNonlocked: false,
    }
  )

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/calendar/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantsCanAddMeetings: settings.assistantsCanAddMeetings,
          assistantsCanAddPractices: settings.assistantsCanAddPractices,
          assistantsCanEditNonlocked: settings.assistantsCanEditNonlocked,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save permissions")
      }

      alert("Permissions updated successfully!")
    } catch (error: any) {
      alert(error.message || "Error saving permissions")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide text-muted-foreground">
            ASSISTANT COACH PERMISSIONS
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Configure what assistant coaches can do with calendar events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.assistantsCanAddMeetings}
                onChange={(e) =>
                  setSettings({ ...settings, assistantsCanAddMeetings: e.target.checked })
                }
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm text-foreground">Assistants can add meetings</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.assistantsCanAddPractices}
                onChange={(e) =>
                  setSettings({ ...settings, assistantsCanAddPractices: e.target.checked })
                }
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm text-foreground">Assistants can add practices</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.assistantsCanEditNonlocked}
                onChange={(e) =>
                  setSettings({ ...settings, assistantsCanEditNonlocked: e.target.checked })
                }
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm text-foreground">Assistants can edit non-locked events</span>
            </label>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Permissions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
