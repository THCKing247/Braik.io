"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface User {
  id: string
  email: string
  name: string | null
  image: string | null
}

interface AccountSettingsProps {
  user: User
}

export function AccountSettings({ user }: AccountSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(user.name || "")
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingPassword, setEditingPassword] = useState(false)

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update profile")
      }

      alert("Profile updated successfully!")
      setEditingProfile(false)
      window.location.reload()
    } catch (error: any) {
      alert(error.message || "Error updating profile")
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match")
      return
    }

    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to change password")
      }

      alert("Password changed successfully!")
      setEditingPassword(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      alert(error.message || "Error changing password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* User Profile */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide text-muted-foreground">
            PROFILE INFORMATION
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Update your name and email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!editingProfile ? (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="font-medium mt-1 text-foreground">{user.name || "Not set"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium mt-1 text-foreground">{user.email}</p>
              </div>
              <Button
                onClick={() => setEditingProfile(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Edit Profile
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingProfile(false)
                    setName(user.name || "")
                    setEmail(user.email)
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

      {/* Password */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide text-muted-foreground">
            PASSWORD
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Change your account password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!editingPassword ? (
            <Button
              onClick={() => setEditingPassword(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Change Password
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-foreground">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={loading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Update Password
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingPassword(false)
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
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

      {/* Security */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide text-muted-foreground">
            SECURITY
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Two-Factor Authentication</Label>
              <p className="text-sm mt-1 text-muted-foreground">Coming soon</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Active Sessions</Label>
              <p className="text-sm mt-1 text-muted-foreground">View and manage your active sessions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
