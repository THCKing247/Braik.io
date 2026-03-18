"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DatePicker, dateToYmd } from "@/components/portal/date-time-picker"

interface Team {
  id: string
  seasonName: string
  rosterCap: number
}

interface SeasonSettingsProps {
  team: Team
}

export function SeasonSettings({ team }: SeasonSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [showRollover, setShowRollover] = useState(false)
  const [rosterCap, setRosterCap] = useState(team.rosterCap.toString())
  const [newSeasonName, setNewSeasonName] = useState("")
  const [newSeasonStart, setNewSeasonStart] = useState<Date | null>(null)
  const [newSeasonEnd, setNewSeasonEnd] = useState<Date | null>(null)
  
  // Division/Standing state
  const [division, setDivision] = useState("")
  const [conference, setConference] = useState("")
  const [seasonLoading, setSeasonLoading] = useState(true)

  // Load current season data
  useEffect(() => {
    const loadSeasonData = async () => {
      try {
        const response = await fetch(`/api/teams/${team.id}/season`)
        if (response.ok) {
          const data = await response.json()
          if (data.season) {
            setDivision(data.season.division || "")
            setConference(data.season.conference || "")
          }
        }
      } catch (error) {
        console.error("Error loading season data:", error)
      } finally {
        setSeasonLoading(false)
      }
    }
    loadSeasonData()
  }, [team.id])

  const handleSaveDivisionStanding = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}/season`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division: division.trim() || null,
          conference: conference.trim() || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update division/standing")
      }

      alert("Division and standing updated successfully!")
      window.location.reload()
    } catch (error: any) {
      alert(error.message || "Error updating division/standing")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRosterCap = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterCap: parseInt(rosterCap),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update roster cap")
      }

      alert("Roster cap updated successfully!")
      window.location.reload()
    } catch (error: any) {
      alert(error.message || "Error updating roster cap")
    } finally {
      setLoading(false)
    }
  }

  const handleSeasonRollover = async () => {
    if (!newSeasonName || !newSeasonStart || !newSeasonEnd) {
      alert("Please fill in all required fields")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/teams/rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          seasonName: newSeasonName,
          seasonStart: dateToYmd(newSeasonStart),
          seasonEnd: dateToYmd(newSeasonEnd),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to rollover season")
      }

      const result = await response.json()
      alert(`Season rolled over successfully! New team ID: ${result.newTeamId}`)
      window.location.href = `/dashboard?teamId=${result.newTeamId}`
    } catch (error: any) {
      alert(error.message || "Error rolling over season")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Division & Standing */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Division & Standing</CardTitle>
          <CardDescription className="text-muted-foreground">
            Set your team&apos;s division and conference for the current season. This information appears on your dashboard header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {seasonLoading ? (
            <p className="text-muted-foreground">Loading season data...</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="division" className="text-foreground">Division (Optional)</Label>
                <Input
                  id="division"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  placeholder="e.g., Division I, 5A, Class A"
                  className="bg-background border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Your team&apos;s division classification (e.g., &quot;5A&quot;, &quot;Division I&quot;)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="conference" className="text-foreground">Conference (Optional)</Label>
                <Input
                  id="conference"
                  value={conference}
                  onChange={(e) => setConference(e.target.value)}
                  placeholder="e.g., Big 12, SEC, Metro Conference"
                  className="bg-background border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Your team&apos;s conference or league name
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> This information is manually entered. If you have access to an external standings API, 
                  we can integrate it in the future. For now, you can update this information as needed.
                </p>
              </div>
              <Button onClick={handleSaveDivisionStanding} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {loading ? "Saving..." : "Save Division & Standing"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roster Cap */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Roster Cap</CardTitle>
          <CardDescription className="text-muted-foreground">
            Set the maximum number of players for this season
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rosterCap" className="text-foreground">Maximum Players</Label>
              <Input
                id="rosterCap"
                type="number"
                value={rosterCap}
                onChange={(e) => setRosterCap(e.target.value)}
                min="1"
                className="bg-background border-border text-foreground"
              />
            </div>
            <Button onClick={handleUpdateRosterCap} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Update Roster Cap
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Season Rollover */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Season Rollover</CardTitle>
          <CardDescription className="text-muted-foreground">
            Create a new season and copy the roster
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showRollover ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Current season: <span className="font-medium text-foreground">{team.seasonName}</span>
              </p>
              <Button onClick={() => setShowRollover(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">Start Season Rollover</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newSeasonName" className="text-foreground">New Season Name *</Label>
                <Input
                  id="newSeasonName"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="e.g., Fall 2025"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePicker
                  id="newSeasonStart"
                  label="Season Start *"
                  value={newSeasonStart}
                  onChange={setNewSeasonStart}
                  placeholder="Select start date"
                />
                <DatePicker
                  id="newSeasonEnd"
                  label="Season End *"
                  value={newSeasonEnd}
                  onChange={setNewSeasonEnd}
                  placeholder="Select end date"
                  minDate={newSeasonStart}
                />
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> This will create a new team for the new season and copy all players as inactive. 
                  You can then activate players as they confirm for the new season.
                </p>
              </div>
              <div className="flex gap-4">
                <Button onClick={handleSeasonRollover} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {loading ? "Rolling over..." : "Rollover Season"}
                </Button>
                <Button variant="outline" onClick={() => setShowRollover(false)} className="border-border text-foreground">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
