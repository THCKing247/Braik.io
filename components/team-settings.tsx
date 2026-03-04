"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Team {
  id: string
  name: string
  slogan?: string | null
  sport: string
  seasonName: string
  seasonStart: Date
  seasonEnd: Date
  rosterCap: number
  duesAmount: number
  duesDueDate: Date | null
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}

export function TeamSettings({ team: initialTeam }: { team: Team }) {
  const [team, setTeam] = useState(initialTeam)
  const [showRollover, setShowRollover] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingIdentity, setEditingIdentity] = useState(false)

  const [teamName, setTeamName] = useState(team.name)
  const [teamSlogan, setTeamSlogan] = useState(team.slogan || "")
  const [logoUrl, setLogoUrl] = useState(team.logoUrl || "")
  const [logoBackground, setLogoBackground] = useState("#FFFFFF")
  const [removeBackground, setRemoveBackground] = useState(false)
  const [newSeasonName, setNewSeasonName] = useState("")
  const [newSeasonStart, setNewSeasonStart] = useState("")
  const [newSeasonEnd, setNewSeasonEnd] = useState("")
  const [newDuesAmount, setNewDuesAmount] = useState(team.duesAmount.toString())
  const [newDuesDueDate, setNewDuesDueDate] = useState("")
  const [editingLogo, setEditingLogo] = useState(false)

  const handleSaveIdentity = async () => {
    if (!teamName.trim()) {
      alert("Team name is required")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName,
          slogan: teamSlogan || null,
          logoUrl: logoUrl || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update team identity")
      }

      const updatedTeam = await response.json()
      setTeam(updatedTeam)
      setEditingIdentity(false)
      alert("Team identity updated successfully!")
      window.location.reload() // Refresh to show new name/slogan in header
    } catch (error: any) {
      alert(error.message || "Error updating team identity")
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
          duesAmount: parseFloat(newDuesAmount),
          duesDueDate: newDuesDueDate || null,
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
      <Card>
        <CardHeader>
          <CardTitle>Team Identity</CardTitle>
          <CardDescription>Edit your team name and slogan</CardDescription>
        </CardHeader>
        <CardContent>
          {!editingIdentity ? (
            <div className="space-y-4">
              <div>
                <Label>Team Name</Label>
                <p className="text-sm text-[#0F172A] font-medium">{team.name}</p>
              </div>
              <div>
                <Label>Slogan</Label>
                <p className="text-sm text-[#0F172A]">
                  {team.slogan || `Go ${team.name}`}
                </p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Default: &quot;Go {'{'}Team Name{'}'}&quot; if not set
                </p>
              </div>
              <Button onClick={() => setEditingIdentity(true)}>Edit Identity</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name *</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamSlogan">Slogan (Optional)</Label>
                <Input
                  id="teamSlogan"
                  value={teamSlogan}
                  onChange={(e) => setTeamSlogan(e.target.value)}
                  placeholder={`e.g., Go ${team.name} or Braik the huddle. Braik the norm.`}
                />
                <p className="text-xs text-[#6B7280]">
                  This appears under the team name on your dashboard header. Defaults to &quot;Go {'{'}Team Name{'}'}&quot; if left empty.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveIdentity} disabled={loading}>
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingIdentity(false)
                    setTeamName(team.name)
                    setTeamSlogan(team.slogan || "")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Logo</CardTitle>
          <CardDescription>Upload and customize your team logo</CardDescription>
        </CardHeader>
        <CardContent>
          {!editingLogo ? (
            <div className="space-y-4">
              {team.logoUrl ? (
                <div className="flex items-center gap-4">
                  <div
                    className="w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden border-2 border-border"
                    style={{
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <img
                      src={team.logoUrl}
                      alt={`${team.name} logo`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-[#0F172A] font-medium">Logo uploaded</p>
                    <p className="text-xs text-[#6B7280]">Click Edit to change or remove</p>
                  </div>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg border-2 border-border border-dashed flex items-center justify-center">
                  <span className="text-sm text-[#6B7280]">No logo uploaded</span>
                </div>
              )}
              <Button onClick={() => setEditingLogo(true)}>Edit Logo</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-[#6B7280]">
                  Enter a URL to your team logo image. File upload coming soon.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoBackground">Logo Background Color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="logoBackground"
                    type="color"
                    value={logoBackground}
                    onChange={(e) => setLogoBackground(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={logoBackground}
                    onChange={(e) => setLogoBackground(e.target.value)}
                    placeholder="#FFFFFF"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-[#6B7280]">
                  Choose a background color for your logo. Use #FFFFFF for white, or transparent for no background.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="removeBackground"
                  checked={removeBackground}
                  onChange={(e) => setRemoveBackground(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="removeBackground" className="cursor-pointer">
                  Remove background (transparent)
                </Label>
              </div>
              {logoUrl && (
                <div className="mt-4">
                  <Label>Preview</Label>
                  <div
                    className="w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden border-2 border-border mt-2"
                    style={{
                      backgroundColor: removeBackground ? "transparent" : logoBackground,
                    }}
                  >
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="max-w-full max-h-full object-contain"
                      style={{
                        mixBlendMode: removeBackground ? "multiply" : "normal",
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    setLoading(true)
                    try {
                      const response = await fetch(`/api/teams/${team.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          logoUrl: logoUrl || null,
                        }),
                      })
                      if (!response.ok) throw new Error("Failed to update logo")
                      const updatedTeam = await response.json()
                      setTeam(updatedTeam)
                      setEditingLogo(false)
                      alert("Logo updated successfully!")
                      window.location.reload()
                    } catch (error: any) {
                      alert(error.message || "Error updating logo")
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                >
                  Save Logo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingLogo(false)
                    setLogoUrl(team.logoUrl || "")
                    setLogoBackground("#FFFFFF")
                    setRemoveBackground(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Season</CardTitle>
          <CardDescription>View current team information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Sport</Label>
              <p className="text-sm text-[#0F172A]">{team.sport}</p>
            </div>
            <div>
              <Label>Season</Label>
              <p className="text-sm text-[#0F172A]">{team.seasonName}</p>
            </div>
            <div>
              <Label>Roster Cap</Label>
              <p className="text-sm text-[#0F172A]">{team.rosterCap}</p>
            </div>
            <div>
              <Label>Dues Amount</Label>
              <p className="text-sm text-[#0F172A]">${team.duesAmount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Season Rollover</CardTitle>
          <CardDescription>Create a new season and copy the roster</CardDescription>
        </CardHeader>
        <CardContent>
          {!showRollover ? (
            <Button onClick={() => setShowRollover(true)}>Start Season Rollover</Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Season Name *</Label>
                <Input
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="e.g., Fall 2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Season Start *</Label>
                  <Input
                    type="date"
                    value={newSeasonStart}
                    onChange={(e) => setNewSeasonStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Season End *</Label>
                  <Input
                    type="date"
                    value={newSeasonEnd}
                    onChange={(e) => setNewSeasonEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dues Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newDuesAmount}
                    onChange={(e) => setNewDuesAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dues Due Date</Label>
                  <Input
                    type="date"
                    value={newDuesDueDate}
                    onChange={(e) => setNewDuesDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="bg-surface-2 border border-border rounded-lg p-4">
                <p className="text-sm text-[#0F172A]">
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
