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
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            TEAM IDENTITY
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
            Edit your team name and slogan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!editingIdentity ? (
            <div className="space-y-4">
              <div>
                <Label style={{ color: "rgb(var(--muted))" }}>Team Name</Label>
                <p className="font-medium mt-1" style={{ color: "rgb(var(--text))" }}>{team.name}</p>
              </div>
              <div>
                <Label style={{ color: "rgb(var(--muted))" }}>Slogan</Label>
                <p className="mt-1" style={{ color: "rgb(var(--text))" }}>
                  {team.slogan || `Go ${team.name}`}
                </p>
                <p className="text-xs mt-1" style={{ color: "rgb(var(--muted))" }}>
                  Default: &quot;Go {'{'}Team Name{'}'}&quot; if not set
                </p>
              </div>
              <Button
                onClick={() => setEditingIdentity(true)}
                style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
              >
                Edit Identity
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName" style={{ color: "rgb(var(--text))" }}>Team Name *</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team Name"
                  required
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamSlogan" style={{ color: "rgb(var(--text))" }}>Slogan (Optional)</Label>
                <Input
                  id="teamSlogan"
                  value={teamSlogan}
                  onChange={(e) => setTeamSlogan(e.target.value)}
                  placeholder={`e.g., Go ${team.name} or Braik the huddle. Braik the norm.`}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  This appears under the team name on your dashboard header. Defaults to &quot;Go {'{'}Team Name{'}'}&quot; if left empty.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveIdentity}
                  disabled={loading}
                  style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingIdentity(false)
                    setTeamName(team.name)
                    setTeamSlogan(team.slogan || "")
                  }}
                  style={{
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
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
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            TEAM LOGO
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
            Upload your team logo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!editingLogo ? (
            <div className="space-y-4">
              {team.logoUrl ? (
                <div className="flex items-center gap-4">
                  <div
                    className="w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden border-2"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "rgb(var(--border))",
                    }}
                  >
                    <img
                      src={team.logoUrl}
                      alt={`${team.name} logo`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>Logo uploaded</p>
                    <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>Click Edit to change or remove</p>
                  </div>
                </div>
              ) : (
                <div
                  className="w-32 h-32 rounded-lg border-2 border-dashed flex items-center justify-center"
                  style={{ borderColor: "rgb(var(--border))" }}
                >
                  <span className="text-sm" style={{ color: "rgb(var(--muted))" }}>No logo uploaded</span>
                </div>
              )}
              <Button
                onClick={() => setEditingLogo(true)}
                style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
              >
                Edit Logo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl" style={{ color: "rgb(var(--text))" }}>Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  Enter a URL to your team logo image. File upload coming soon.
                </p>
              </div>
              {logoUrl && (
                <div className="mt-4">
                  <Label style={{ color: "rgb(var(--text))" }}>Preview</Label>
                  <div
                    className="w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden border-2 mt-2"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "rgb(var(--border))",
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
                <Button
                  onClick={handleSaveLogo}
                  disabled={loading}
                  style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                >
                  Save Logo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingLogo(false)
                    setLogoUrl(team.logoUrl || "")
                  }}
                  style={{
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
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
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            TEAM INFORMATION
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
            View current team information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label style={{ color: "rgb(var(--muted))" }}>Sport</Label>
              <p className="font-medium mt-1" style={{ color: "rgb(var(--text))" }}>{team.sport}</p>
            </div>
            <div>
              <Label style={{ color: "rgb(var(--muted))" }}>Organization</Label>
              <p className="font-medium mt-1" style={{ color: "rgb(var(--text))" }}>{team.organization.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
