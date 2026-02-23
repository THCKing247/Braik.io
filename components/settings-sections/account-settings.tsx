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
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Profile Information</CardTitle>
          <CardDescription className="text-white/70">
            Update your name and email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!editingProfile ? (
            <div className="space-y-4">
              <div>
                <Label className="text-white/70">Name</Label>
                <p className="text-white font-medium">{user.name || "Not set"}</p>
              </div>
              <div>
                <Label className="text-white/70">Email</Label>
                <p className="text-white font-medium">{user.email}</p>
              </div>
              <Button onClick={() => setEditingProfile(true)}>Edit Profile</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} disabled={loading}>
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingProfile(false)
                    setName(user.name || "")
                    setEmail(user.email)
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
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Password</CardTitle>
          <CardDescription className="text-white/70">
            Change your account password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!editingPassword ? (
            <Button onClick={() => setEditingPassword(true)}>Change Password</Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-white">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-white">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
                <p className="text-xs text-white/60">Must be at least 8 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleChangePassword} disabled={loading}>
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
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Security</CardTitle>
          <CardDescription className="text-white/70">
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-white/70">Two-Factor Authentication</Label>
              <p className="text-sm text-white/60 mt-1">Coming soon</p>
            </div>
            <div>
              <Label className="text-white/70">Active Sessions</Label>
              <p className="text-sm text-white/60 mt-1">View and manage your active sessions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
