"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide text-muted-foreground">
            DISPLAY PREFERENCES
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Configure how information is displayed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Layout Preferences</Label>
              <p className="text-sm mt-1 text-muted-foreground">
                Display and layout preferences will be available here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
