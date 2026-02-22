"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"

interface Invite {
  id: string
  email: string
  role: string
  expiresAt: Date | null
  acceptedAt: Date | null
  createdAt: Date
  creator: { name: string | null; email: string }
}

export function InviteManager({ teamId, invites: initialInvites }: { teamId: string; invites: Invite[] }) {
  const [invites, setInvites] = useState(initialInvites)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState("")
  const [role, setRole] = useState("PLAYER")
  const [bulkEmails, setBulkEmails] = useState("")
  const [bulkRole, setBulkRole] = useState("PLAYER")

  const handleSendInvite = async () => {
    if (!email) {
      alert("Email is required")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          email,
          role,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send invite")
      }

      const newInvite = await response.json()
      setInvites([newInvite, ...invites])
      setEmail("")
      setShowAddForm(false)
    } catch (error: any) {
      alert(error.message || "Error sending invite")
    } finally {
      setLoading(false)
    }
  }

  const handleBulkInvite = async () => {
    if (!bulkEmails.trim()) {
      alert("Please enter email addresses")
      return
    }

    const emails = bulkEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes("@"))

    if (emails.length === 0) {
      alert("No valid email addresses found")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/invites/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          emails,
          role: bulkRole,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send invites")
      }

      const newInvites = await response.json()
      setInvites([...newInvites, ...invites])
      setBulkEmails("")
      setShowBulkForm(false)
      alert(`Successfully sent ${newInvites.length} invites`)
    } catch (error: any) {
      alert(error.message || "Error sending invites")
    } finally {
      setLoading(false)
    }
  }

  const handleResendInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/invites/${inviteId}/resend`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to resend invite")
      }

      alert("Invite resent successfully")
    } catch (error) {
      alert("Error resending invite")
    }
  }

  return (
    <div>
      <div className="mb-6 flex gap-4">
        {!showAddForm && !showBulkForm && (
          <>
            <Button onClick={() => setShowAddForm(true)}>Send Single Invite</Button>
            <Button variant="outline" onClick={() => setShowBulkForm(true)}>Bulk Invite (CSV/List)</Button>
          </>
        )}
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Send Invite</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <option value="ASSISTANT_COACH">Assistant Coach</option>
                  <option value="PLAYER">Player</option>
                  <option value="PARENT">Parent</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <Button onClick={handleSendInvite} disabled={loading}>
                {loading ? "Sending..." : "Send Invite"}
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showBulkForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Bulk Invite</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Emails (one per line or comma-separated) *</Label>
                <textarea
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  className="flex min-h-[120px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                  placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <option value="ASSISTANT_COACH">Assistant Coach</option>
                  <option value="PLAYER">Player</option>
                  <option value="PARENT">Parent</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <Button onClick={handleBulkInvite} disabled={loading}>
                {loading ? "Sending..." : `Send ${bulkEmails.split(/[,\n]/).filter(e => e.trim().includes("@")).length} Invites`}
              </Button>
              <Button variant="outline" onClick={() => setShowBulkForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold" style={{ color: "#000000" }}>Pending Invites</h2>
        {invites.filter((i) => !i.acceptedAt).length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center" style={{ color: "#000000" }}>
              No pending invites
            </CardContent>
          </Card>
        ) : (
          invites
            .filter((i) => !i.acceptedAt)
            .map((invite) => (
              <Card key={invite.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold" style={{ color: "#000000" }}>{invite.email}</h3>
                      <div className="text-sm mt-1" style={{ color: "#000000" }}>
                        Role: {invite.role.replace("_", " ")} • Expires: {invite.expiresAt ? format(new Date(invite.expiresAt), "MMM d, yyyy") : "Never"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleResendInvite(invite.id)}>
                        Resend
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>

      {invites.filter((i) => i.acceptedAt).length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold" style={{ color: "#000000" }}>Accepted Invites</h2>
          {invites
            .filter((i) => i.acceptedAt)
            .map((invite) => (
              <Card key={invite.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold" style={{ color: "#000000" }}>{invite.email}</h3>
                      <div className="text-sm mt-1" style={{ color: "#000000" }}>
                        Role: {invite.role.replace("_", " ")} • Accepted: {format(new Date(invite.acceptedAt!), "MMM d, yyyy")}
                      </div>
                    </div>
                    <span className="text-sm" style={{ color: "#22C55E" }}>✓ Accepted</span>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
