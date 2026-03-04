"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

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
  const [newSeasonStart, setNewSeasonStart] = useState("")
  const [newSeasonEnd, setNewSeasonEnd] = useState("")
  
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
          seasonStart: newSeasonStart,
          seasonEnd: newSeasonEnd,
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
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Division & Standing</CardTitle>
          <CardDescription className="text-white/70">
            Set your team&apos;s division and conference for the current season. This information appears on your dashboard header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {seasonLoading ? (
            <p className="text-white/70">Loading season data...</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="division" className="text-white">Division (Optional)</Label>
                <Input
                  id="division"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  placeholder="e.g., Division I, 5A, Class A"
                  className="bg-white/10 border-white/20 text-white"
                />
                <p className="text-xs text-white/60">
                  Your team&apos;s division classification (e.g., &quot;5A&quot;, &quot;Division I&quot;)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="conference" className="text-white">Conference (Optional)</Label>
                <Input
                  id="conference"
                  value={conference}
                  onChange={(e) => setConference(e.target.value)}
                  placeholder="e.g., Big 12, SEC, Metro Conference"
                  className="bg-white/10 border-white/20 text-white"
                />
                <p className="text-xs text-white/60">
                  Your team&apos;s conference or league name
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-sm text-white/80">
                  <strong>Note:</strong> This information is manually entered. If you have access to an external standings API, 
                  we can integrate it in the future. For now, you can update this information as needed.
                </p>
              </div>
              <Button onClick={handleSaveDivisionStanding} disabled={loading}>
                {loading ? "Saving..." : "Save Division & Standing"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roster Cap */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Roster Cap</CardTitle>
          <CardDescription className="text-white/70">
            Set the maximum number of players for this season
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rosterCap" className="text-white">Maximum Players</Label>
              <Input
                id="rosterCap"
                type="number"
                value={rosterCap}
                onChange={(e) => setRosterCap(e.target.value)}
                min="1"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <Button onClick={handleUpdateRosterCap} disabled={loading}>
              Update Roster Cap
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Season Rollover */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Season Rollover</CardTitle>
          <CardDescription className="text-white/70">
            Create a new season and copy the roster
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showRollover ? (
            <div className="space-y-4">
              <p className="text-white/70">
                Current season: <span className="font-medium text-white">{team.seasonName}</span>
              </p>
              <Button onClick={() => setShowRollover(true)}>Start Season Rollover</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newSeasonName" className="text-white">New Season Name *</Label>
                <Input
                  id="newSeasonName"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="e.g., Fall 2025"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newSeasonStart" className="text-white">Season Start *</Label>
                  <Input
                    id="newSeasonStart"
                    type="date"
                    value={newSeasonStart}
                    onChange={(e) => setNewSeasonStart(e.target.value)}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newSeasonEnd" className="text-white">Season End *</Label>
                  <Input
                    id="newSeasonEnd"
                    type="date"
                    value={newSeasonEnd}
                    onChange={(e) => setNewSeasonEnd(e.target.value)}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-sm text-white/80">
                  <strong>Note:</strong> This will create a new team for the new season and copy all players as inactive. 
                  You can then activate players as they confirm for the new season.
                </p>
              </div>
              <div className="flex gap-4">
                <Button onClick={handleSeasonRollover} disabled={loading}>
                  {loading ? "Rolling over..." : "Rollover Season"}
                </Button>
                <Button variant="outline" onClick={() => setShowRollover(false)}>
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
