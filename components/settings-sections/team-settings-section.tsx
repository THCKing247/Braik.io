"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface Team {
  id: string
  name: string
  slogan: string | null
  sport: string
  logoUrl: string | null
  organization: {
    name: string
  }
}

interface TeamSettingsSectionProps {
  team: Team
}

export function TeamSettingsSection({ team: initialTeam }: TeamSettingsSectionProps) {
  const [team, setTeam] = useState(initialTeam)
  const [loading, setLoading] = useState(false)
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [editingLogo, setEditingLogo] = useState(false)

  const [teamName, setTeamName] = useState(team.name)
  const [teamSlogan, setTeamSlogan] = useState(team.slogan || "")
  const [logoUrl, setLogoUrl] = useState(team.logoUrl || "")

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
      window.location.reload()
    } catch (error: any) {
      alert(error.message || "Error updating team identity")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveLogo = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: logoUrl || null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update logo")
      }

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
  }

  return (
    <div className="space-y-6">
      {/* Team Identity */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Team Identity</CardTitle>
          <CardDescription className="text-white/70">
            Edit your team name and slogan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!editingIdentity ? (
            <div className="space-y-4">
              <div>
                <Label className="text-white/70">Team Name</Label>
                <p className="text-white font-medium">{team.name}</p>
              </div>
              <div>
                <Label className="text-white/70">Slogan</Label>
                <p className="text-white">
                  {team.slogan || `Go ${team.name}`}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  Default: &quot;Go {'{'}Team Name{'}'}&quot; if not set
                </p>
              </div>
              <Button onClick={() => setEditingIdentity(true)}>Edit Identity</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName" className="text-white">Team Name *</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team Name"
                  required
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamSlogan" className="text-white">Slogan (Optional)</Label>
                <Input
                  id="teamSlogan"
                  value={teamSlogan}
                  onChange={(e) => setTeamSlogan(e.target.value)}
                  placeholder={`e.g., Go ${team.name} or Braik the huddle. Braik the norm.`}
                  className="bg-white/10 border-white/20 text-white"
                />
                <p className="text-xs text-white/60">
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

      {/* Team Logo */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Team Logo</CardTitle>
          <CardDescription className="text-white/70">
            Upload your team logo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!editingLogo ? (
            <div className="space-y-4">
              {team.logoUrl ? (
                <div className="flex items-center gap-4">
                  <div
                    className="w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden border-2 border-white/20"
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
                    <p className="text-sm text-white font-medium">Logo uploaded</p>
                    <p className="text-xs text-white/60">Click Edit to change or remove</p>
                  </div>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg border-2 border-white/20 border-dashed flex items-center justify-center">
                  <span className="text-sm text-white/60">No logo uploaded</span>
                </div>
              )}
              <Button onClick={() => setEditingLogo(true)}>Edit Logo</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl" className="text-white">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="bg-white/10 border-white/20 text-white"
                />
                <p className="text-xs text-white/60">
                  Enter a URL to your team logo image. File upload coming soon.
                </p>
              </div>
              {logoUrl && (
                <div className="mt-4">
                  <Label className="text-white">Preview</Label>
                  <div
                    className="w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden border-2 border-white/20 mt-2"
                    style={{
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSaveLogo} disabled={loading}>
                  Save Logo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingLogo(false)
                    setLogoUrl(team.logoUrl || "")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sport & Current Season (Read-only) */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Team Information</CardTitle>
          <CardDescription className="text-white/70">
            View current team information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-white/70">Sport</Label>
              <p className="text-white font-medium">{team.sport}</p>
            </div>
            <div>
              <Label className="text-white/70">Organization</Label>
              <p className="text-white font-medium">{team.organization.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
