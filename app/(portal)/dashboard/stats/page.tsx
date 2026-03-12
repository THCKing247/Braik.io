"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function StatsPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "rgb(var(--text))" }}>
              Stats / Analytics
            </h1>
            <p style={{ color: "rgb(var(--muted))" }}>
              Team statistics and analytics dashboard
            </p>
          </div>

          <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
            <CardHeader>
              <CardTitle style={{ color: "rgb(var(--text))" }}>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: "rgb(var(--muted))" }}>
                The Stats / Analytics dashboard is under development. This will include team performance metrics, player statistics, and detailed analytics.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardPageShell>
  )
}
