"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { prefetchPropForDashboardScheduleHref } from "@/lib/navigation/dashboard-schedule-prefetch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Head coach team join code — shared layout for Settings → Team and other surfaces that need the code.
 */
export function TeamCodeCard({ teamIdCode }: { teamIdCode: string }) {
  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="uppercase text-xs font-bold tracking-wide text-muted-foreground">
          Team code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {teamIdCode ? (
          <>
            <p className="text-sm text-muted-foreground">
              Share this team join code during player signup so athletes land on the correct team. Parents use Parent Access with a
              player-specific parent link code from the coach.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-6">
              <p className="text-sm mb-2 text-muted-foreground">Team Code</p>
              <p className="text-4xl font-bold font-mono tracking-wider text-foreground">{teamIdCode}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Players use player signup and enter this team code when prompted; assistants receive invites through your program&apos;s
              Braik admin.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              No team code has been generated yet. Generate one so others can join your team.
            </p>
            <Link href="/dashboard/settings" prefetch={prefetchPropForDashboardScheduleHref("/dashboard/settings")}>
              <Button variant="outline" className="border-border text-foreground">
                Open Settings
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
