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
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            PROFILE INFORMATION
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
            Update your name and email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!editingProfile ? (
            <div className="space-y-4">
              <div>
                <Label style={{ color: "rgb(var(--muted))" }}>Name</Label>
                <p className="font-medium mt-1" style={{ color: "rgb(var(--text))" }}>{user.name || "Not set"}</p>
              </div>
              <div>
                <Label style={{ color: "rgb(var(--muted))" }}>Email</Label>
                <p className="font-medium mt-1" style={{ color: "rgb(var(--text))" }}>{user.email}</p>
              </div>
              <Button
                onClick={() => setEditingProfile(true)}
                style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
              >
                Edit Profile
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" style={{ color: "rgb(var(--text))" }}>Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: "rgb(var(--text))" }}>Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
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

      {/* Password */}
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            PASSWORD
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
            Change your account password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!editingPassword ? (
            <Button
              onClick={() => setEditingPassword(true)}
              style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
            >
              Change Password
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" style={{ color: "rgb(var(--text))" }}>Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" style={{ color: "rgb(var(--text))" }}>New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>Must be at least 8 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" style={{ color: "rgb(var(--text))" }}>Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={loading}
                  style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
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

      {/* Security */}
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            SECURITY
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label style={{ color: "rgb(var(--muted))" }}>Two-Factor Authentication</Label>
              <p className="text-sm mt-1" style={{ color: "rgb(var(--muted))" }}>Coming soon</p>
            </div>
            <div>
              <Label style={{ color: "rgb(var(--muted))" }}>Active Sessions</Label>
              <p className="text-sm mt-1" style={{ color: "rgb(var(--muted))" }}>View and manage your active sessions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
