"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            DISPLAY PREFERENCES
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
            Configure how information is displayed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label style={{ color: "rgb(var(--muted))" }}>Layout Preferences</Label>
              <p className="text-sm mt-1" style={{ color: "rgb(var(--muted))" }}>
                Display and layout preferences will be available here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
