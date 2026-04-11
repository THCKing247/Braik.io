"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
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
              Share this team code with Assistant Coaches, Players, and Parents so they can join your team.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-6">
              <p className="text-sm mb-2 text-muted-foreground">Team Code</p>
              <p className="text-4xl font-bold font-mono tracking-wider text-foreground">{teamIdCode}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              This code is required when other users sign up to join your team.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              No team code has been generated yet. Generate one so others can join your team.
            </p>
            <Link href="/dashboard/settings">
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
