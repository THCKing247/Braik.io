"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Display Preferences</CardTitle>
          <CardDescription className="text-white/70">
            Configure how information is displayed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-white/70">Layout Preferences</Label>
              <p className="text-sm text-white/60 mt-1">
                Display and layout preferences will be available here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
