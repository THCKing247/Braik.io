"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function TeamCodeSettingsCard({
  teamId,
  isHeadCoach,
}: {
  teamId: string
  isHeadCoach: boolean
}) {
  const [teamIdCode, setTeamIdCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchCodes = async () => {
    if (!teamId) return
    try {
      const res = await fetch(`/api/roster/codes?teamId=${encodeURIComponent(teamId)}`)
      if (res.ok) {
        const data = await res.json()
        setTeamIdCode(data.teamIdCode ?? null)
      }
    } catch (_) {
      setTeamIdCode(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCodes()
  }, [teamId])

  const handleGenerate = async () => {
    if (!teamId) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/roster/generate-codes?teamId=${encodeURIComponent(teamId)}`, {
        method: "POST",
      })
      if (res.ok) {
        const data = await res.json()
        setTeamIdCode(data.teamIdCode ?? null)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Failed to generate team code")
      }
    } catch (e) {
      alert("Failed to generate team code")
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (teamIdCode) {
      navigator.clipboard.writeText(teamIdCode).then(() => alert("Team code copied to clipboard"))
    }
  }

  if (!isHeadCoach) return null
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Code</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Code</CardTitle>
        <CardDescription>
          Share this code with Assistant Coaches, Players, and Parents so they can join your team. You can also find it under Invoice → Subscription.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {teamIdCode ? (
          <>
            <div className="p-4 rounded-lg border bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Team Code</p>
              <p className="text-2xl font-bold font-mono tracking-wider">{teamIdCode}</p>
            </div>
            <Button variant="outline" onClick={handleCopy}>
              Copy Team Code
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              No team code has been generated yet. Generate one so others can join your team.
            </p>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "Generating…" : "Generate Team Code"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
