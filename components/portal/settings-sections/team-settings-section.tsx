"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ConfirmDestructiveDialog } from "@/components/portal/confirm-destructive-dialog"
import { PlayerSignupQrCard } from "@/components/portal/player-signup-qr-card"
import { TeamCodeCard } from "@/components/portal/team-code-card"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { Loader2, ImagePlus } from "lucide-react"

const ACCEPTED_TYPES = "image/png,image/jpeg,image/jpg"
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024 // 3MB

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
  onTeamUpdated?: (updates: Partial<Team> | Team) => void
}

export function TeamSettingsSection({ team: initialTeam, onTeamUpdated }: TeamSettingsSectionProps) {
  const [team, setTeam] = useState(initialTeam)
  const { showToast } = usePlaybookToast()

  useEffect(() => {
    setTeam(initialTeam)
    setTeamName(initialTeam.name)
    setTeamSlogan(initialTeam.slogan || "")
    setLogoUrl(initialTeam.logoUrl || "")
  }, [initialTeam.id, initialTeam.name, initialTeam.slogan, initialTeam.logoUrl])
  const [loading, setLoading] = useState(false)
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [editingLogo, setEditingLogo] = useState(false)

  const [teamName, setTeamName] = useState(team.name)
  const [teamSlogan, setTeamSlogan] = useState(team.slogan || "")
  const [logoUrl, setLogoUrl] = useState(team.logoUrl || "")

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removeLogoDialogOpen, setRemoveLogoDialogOpen] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [teamIdCode, setTeamIdCode] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    const loadCode = async () => {
      try {
        const res = await fetch(`/api/roster/codes?teamId=${encodeURIComponent(team.id)}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { teamIdCode?: string }
        if (!cancelled) setTeamIdCode(data.teamIdCode || "")
      } catch {
        /* ignore */
      }
    }
    void loadCode()
    return () => {
      cancelled = true
    }
  }, [team.id])

  const handleSaveIdentity = async () => {
    if (!teamName.trim()) {
      showToast("Team name is required", "error")
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
      onTeamUpdated?.(updatedTeam)
      showToast("Team settings updated.", "success")
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Error updating team identity", "error")
    } finally {
      setLoading(false)
    }
  }

  const validateFile = (file: File): string | null => {
    const allowed = ["image/png", "image/jpeg", "image/jpg"]
    if (!allowed.includes(file.type)) {
      return "Only PNG and JPG/JPEG images are allowed."
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "File size must be 3MB or less."
    }
    return null
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setUploadError(null)
    setUploadPreview(null)
    setUploadFile(null)
    if (!file) return
    const err = validateFile(file)
    if (err) {
      setUploadError(err)
      return
    }
    setUploadFile(file)
    const reader = new FileReader()
    reader.onload = () => setUploadPreview(reader.result as string)
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleUploadLogo = async () => {
    if (!uploadFile) {
      setUploadError("Please select an image to upload.")
      return
    }
    const err = validateFile(uploadFile)
    if (err) {
      setUploadError(err)
      return
    }

    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      const response = await fetch(`/api/teams/${team.id}/logo`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Upload failed")
      }

      const newLogoUrl = data.logoUrl as string
      setTeam((prev) => ({ ...prev, logoUrl: newLogoUrl }))
      setLogoUrl(newLogoUrl)
      setUploadFile(null)
      setUploadPreview(null)
      setEditingLogo(false)
      onTeamUpdated?.({ logoUrl: newLogoUrl })
      showToast("Logo uploaded successfully.", "success")
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Upload failed. Please try again."
      setUploadError(msg)
      showToast(msg, "error")
    } finally {
      setUploading(false)
    }
  }

  const handleSaveLogoUrl = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: logoUrl || null }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update logo")
      }

      const updatedTeam = await response.json()
      setTeam(updatedTeam)
      setEditingLogo(false)
      onTeamUpdated?.({ logoUrl: updatedTeam.logoUrl ?? null })
      showToast("Logo updated successfully.", "success")
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Error updating logo", "error")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveLogo = async () => {
    setRemovingLogo(true)
    try {
      const response = await fetch(`/api/teams/${team.id}/logo`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to remove logo")
      }
      setTeam((prev) => ({ ...prev, logoUrl: null }))
      setLogoUrl("")
      setRemoveLogoDialogOpen(false)
      onTeamUpdated?.({ logoUrl: null })
      showToast("Logo removed.", "success")
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Failed to remove logo", "error")
    } finally {
      setRemovingLogo(false)
    }
  }

  const displayLogoUrl = uploadPreview ? uploadPreview : (team.logoUrl || logoUrl || null)

  return (
    <div className="space-y-6">
      {/* Team Identity */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide text-muted-foreground">
            TEAM IDENTITY
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Edit your team name and slogan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!editingIdentity ? (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Team Name</Label>
                <p className="font-medium mt-1 text-foreground">{team.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Slogan</Label>
                <p className="mt-1 text-foreground">
                  {team.slogan || `Go ${team.name}`}
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  Default: &quot;Go {'{'}Team Name{'}'}&quot; if not set
                </p>
              </div>
              <Button
                onClick={() => setEditingIdentity(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Edit Identity
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName" className="text-foreground">Team Name *</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team Name"
                  required
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamSlogan" className="text-foreground">Slogan (Optional)</Label>
                <Input
                  id="teamSlogan"
                  value={teamSlogan}
                  onChange={(e) => setTeamSlogan(e.target.value)}
                  placeholder={`e.g., Go ${team.name} or Braik the huddle. Braik the norm.`}
                  className="bg-background border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  This appears under the team name on your dashboard header. Defaults to &quot;Go {'{'}Team Name{'}'}&quot; if left empty.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveIdentity}
                  disabled={loading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                  className="border-border text-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TeamCodeCard teamIdCode={teamIdCode} />

      <PlayerSignupQrCard teamId={team.id} />

      {/* Team Logo */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide text-muted-foreground">
            TEAM LOGO
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload your team logo (PNG or JPG, max 3MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!editingLogo ? (
            <div className="space-y-4">
              {team.logoUrl ? (
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden border-2 border-border bg-muted/30">
                    <img
                      src={team.logoUrl}
                      alt={`${team.name} logo`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Logo uploaded</p>
                    <p className="text-xs text-muted-foreground">Click Edit to change or remove</p>
                  </div>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
                  <span className="text-sm text-muted-foreground">No logo uploaded</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => setEditingLogo(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Edit Logo
                </Button>
                {team.logoUrl && (
                  <Button
                    variant="outline"
                    onClick={() => setRemoveLogoDialogOpen(true)}
                    className="border-border text-foreground"
                  >
                    Remove Logo
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="space-y-2">
                <Label className="text-foreground">Upload image</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-border text-foreground"
                  >
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Choose file
                  </Button>
                  {uploadFile && (
                    <span className="text-sm text-muted-foreground">
                      {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Accepted: PNG, JPG, or JPEG. Maximum file size: 3 MB. Uploading replaces the current logo.
                </p>
                {uploadError && (
                  <p className="text-sm text-destructive">{uploadError}</p>
                )}
              </div>

              {displayLogoUrl && (
                <div>
                  <Label className="text-foreground">Preview</Label>
                  <div className="w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden border-2 border-border bg-muted/30 mt-2">
                    <img
                      src={displayLogoUrl}
                      alt="Logo preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {uploadFile && (
                  <Button
                    onClick={handleUploadLogo}
                    disabled={uploading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      "Upload logo"
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingLogo(false)
                    setLogoUrl(team.logoUrl || "")
                    setUploadFile(null)
                    setUploadPreview(null)
                    setUploadError(null)
                  }}
                  className="border-border text-foreground"
                >
                  Cancel
                </Button>
              </div>

              <div className="pt-2 border-t border-border">
                <Label htmlFor="logoUrl" className="text-foreground">Or paste logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="bg-background border-border text-foreground mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a URL to use an external image instead of uploading.
                </p>
                {logoUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveLogoUrl}
                    disabled={loading}
                    className="mt-2"
                    type="button"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        Saving…
                      </>
                    ) : (
                      "Save URL"
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Information (Read-only) */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide text-muted-foreground">
            TEAM INFORMATION
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            View current team information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Sport</Label>
              <p className="font-medium mt-1 text-foreground">{team.sport}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Organization</Label>
              <p className="font-medium mt-1 text-foreground">{team.organization.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDestructiveDialog
        open={removeLogoDialogOpen}
        onOpenChange={setRemoveLogoDialogOpen}
        title="Remove logo"
        message="Remove the team logo? You can upload a new one anytime."
        confirmLabel="Remove logo"
        isDeleting={removingLogo}
        onConfirm={handleRemoveLogo}
      />
    </div>
  )
}
