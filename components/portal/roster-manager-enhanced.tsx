"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RosterGridView } from "./roster-grid-view"
import { DepthChartView } from "./depth-chart-view"

/** Configurable billing warning when coach creates a player (no account yet). Override via NEXT_PUBLIC_ROSTER_BILLING_WARNING env. */
const ROSTER_BILLING_WARNING =
  typeof process.env.NEXT_PUBLIC_ROSTER_BILLING_WARNING === "string" && process.env.NEXT_PUBLIC_ROSTER_BILLING_WARNING.trim()
    ? process.env.NEXT_PUBLIC_ROSTER_BILLING_WARNING.trim()
    : "If this player later creates an account and joins your team, this will count toward your billable roster total (additional roster slot)."

interface Player {
  id: string
  firstName: string
  lastName: string
  grade: number | null
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  notes: string | null
  imageUrl?: string | null
  email?: string | null
  inviteCode?: string | null
  inviteStatus?: "not_invited" | "invited" | "joined"
  claimedAt?: string | null
  user: { email: string } | null
  guardianLinks: Array<{
    guardian: { user: { email: string } }
  }>
}

interface DepthChartEntry {
  id: string
  unit: string
  position: string
  string: number
  playerId: string | null
  player?: Player | null
  formation?: string | null
  specialTeamType?: string | null
}

interface RosterManagerEnhancedProps {
  teamId: string
  players: Player[]
  canEdit: boolean
  teamSport: string
  userRole?: string
}

function EditPlayerModal({
  player,
  onSave,
  onCancel,
  loading,
}: {
  player: Player
  onSave: (payload: {
    firstName: string
    lastName: string
    grade: number | null
    jerseyNumber: number | null
    positionGroup: string | null
    notes: string | null
    email?: string | null
  }) => void
  onCancel: () => void
  loading: boolean
}) {
  const [firstName, setFirstName] = useState(player.firstName)
  const [lastName, setLastName] = useState(player.lastName)
  const [grade, setGrade] = useState(player.grade != null ? String(player.grade) : "")
  const [jerseyNumber, setJerseyNumber] = useState(player.jerseyNumber != null ? String(player.jerseyNumber) : "")
  const [positionGroup, setPositionGroup] = useState(player.positionGroup ?? "")
  const [notes, setNotes] = useState(player.notes ?? "")
  const [email, setEmail] = useState(player.email ?? "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      alert("First and last name are required")
      return
    }
    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      grade: grade === "" ? null : parseInt(grade, 10),
      jerseyNumber: jerseyNumber === "" ? null : parseInt(jerseyNumber, 10),
      positionGroup: positionGroup.trim() || null,
      notes: notes.trim() || null,
      email: email.trim() || null,
    })
  }

  return (
    <Card className="w-full max-w-md bg-white border border-[#E5E7EB]" onClick={(e) => e.stopPropagation()}>
      <CardHeader>
        <CardTitle className="text-[#0F172A]">Edit Player</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label className="text-[#0F172A]">First Name *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label className="text-[#0F172A]">Last Name *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-[#0F172A]">Grade</Label>
            <Input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-[#0F172A]">Jersey Number</Label>
            <Input type="number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-[#0F172A]">Position</Label>
            <Input value={positionGroup} onChange={(e) => setPositionGroup(e.target.value)} placeholder="e.g. QB, RB" />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-[#0F172A]">Email (optional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-[#0F172A]">Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
              placeholder="Eligibility, injuries, etc."
            />
          </div>
          <div className="col-span-2 flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function InviteLinkModal({
  playerName,
  inviteCode,
  onClose,
}: {
  playerName: string
  inviteCode: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [joinUrl, setJoinUrl] = useState("")
  useEffect(() => {
    setJoinUrl(typeof window !== "undefined" ? `${window.location.origin}/dashboard` : "")
  }, [])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleCopyLink = () => {
    const text = joinUrl ? `${joinUrl}\n\nTeam/player code: ${inviteCode}` : inviteCode
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Card className="w-full max-w-md bg-white border border-[#E5E7EB]" onClick={(e) => e.stopPropagation()}>
      <CardHeader>
        <CardTitle className="text-[#0F172A]">Invite link for {playerName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#475569]">
          Share this code with the player. They can enter it on the dashboard to join your team and link to this roster spot.
        </p>
        <div className="flex items-center gap-2">
          <Input readOnly value={inviteCode} className="font-mono" />
          <Button variant="outline" size="sm" onClick={handleCopyCode}>
            {copied ? "Copied!" : "Copy code"}
          </Button>
        </div>
        {joinUrl && (
          <div className="space-y-2">
            <Label className="text-[#0F172A] text-xs">Or copy join link (includes code in instructions)</Label>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="w-full">
              {copied ? "Copied!" : "Copy join link & code"}
            </Button>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function RosterManagerEnhanced({ 
  teamId, 
  players: initialPlayers, 
  canEdit,
  teamSport,
  userRole
}: RosterManagerEnhancedProps) {
  const [players, setPlayers] = useState(initialPlayers)
  const [activeTab, setActiveTab] = useState<"roster" | "depth-chart">("roster")
  const [depthChart, setDepthChart] = useState<DepthChartEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showImportForm, setShowImportForm] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [grade, setGrade] = useState("")
  const [jerseyNumber, setJerseyNumber] = useState("")
  const [positionGroup, setPositionGroup] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [showBillingWarningModal, setShowBillingWarningModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [inviteModal, setInviteModal] = useState<{ player: Player; inviteCode: string } | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  const isFootball = teamSport?.toLowerCase() === "football"

  // Load depth chart data
  useEffect(() => {
    if (isFootball && activeTab === "depth-chart") {
      loadDepthChart()
    }
  }, [teamId, isFootball, activeTab])

  const loadDepthChart = async () => {
    try {
      const response = await fetch(`/api/roster/depth-chart?teamId=${teamId}`)
      if (response.ok) {
        const data = await response.json()
        setDepthChart(data.entries || [])
      }
    } catch (error) {
      console.error("Failed to load depth chart:", error)
    }
  }

  const submitAddPlayer = async () => {
    if (!firstName || !lastName) return
    setLoading(true)
    setShowBillingWarningModal(false)
    try {
      const response = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          firstName,
          lastName,
          grade: grade ? parseInt(grade, 10) : null,
          jerseyNumber: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
          positionGroup: positionGroup || null,
          email: email || null,
          notes: notes || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to add player")
      }
      const newPlayer = data as Player
      setPlayers([...players, newPlayer])
      setFirstName("")
      setLastName("")
      setGrade("")
      setJerseyNumber("")
      setPositionGroup("")
      setEmail("")
      setNotes("")
      setShowAddForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error adding player")
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlayer = () => {
    if (!firstName || !lastName) {
      alert("First and last name are required")
      return
    }
    setShowBillingWarningModal(true)
  }

  const handleCsvImport = async () => {
    if (!csvFile) {
      alert("Please select a CSV file")
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", csvFile)
      formData.append("teamId", teamId)

      const response = await fetch("/api/roster/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to import CSV")
      }

      const result = await response.json()
      setPlayers([...players, ...result.players])
      setCsvFile(null)
      setShowImportForm(false)
      alert(`Successfully imported ${result.players.length} players`)
    } catch (error: any) {
      alert(error.message || "Error importing CSV")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEdit = async (payload: {
    firstName: string
    lastName: string
    grade: number | null
    jerseyNumber: number | null
    positionGroup: string | null
    notes: string | null
    email?: string | null
  }) => {
    if (!editingPlayer) return
    setLoading(true)
    try {
      const response = await fetch(`/api/roster/${editingPlayer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: payload.firstName,
          lastName: payload.lastName,
          grade: payload.grade,
          jerseyNumber: payload.jerseyNumber,
          positionGroup: payload.positionGroup || null,
          notes: payload.notes || null,
          email: payload.email ?? undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? "Failed to update player")
      }
      const updated = data as Player
      setPlayers((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, user: editingPlayer.user, guardianLinks: editingPlayer.guardianLinks ?? [] } : p)))
      setEditingPlayer(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating player")
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePlayer = async (player: Player) => {
    if (!confirm(`Remove ${player.firstName} ${player.lastName} from the roster? This cannot be undone.`)) {
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`/api/roster/${player.id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Failed to delete player")
      }
      setPlayers((prev) => prev.filter((p) => p.id !== player.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting player")
    } finally {
      setLoading(false)
    }
  }

  const handleSendInvite = async (player: Player) => {
    if (player.user) {
      alert("This player has already linked an account.")
      return
    }
    setInviteLoading(true)
    try {
      const response = await fetch(`/api/roster/${player.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? "Failed to generate invite")
      }
      const code = (data as { inviteCode?: string }).inviteCode
      if (code) {
        setInviteModal({ player, inviteCode: code })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error sending invite")
    } finally {
      setInviteLoading(false)
    }
  }

  const handleDepthChartUpdate = async (updates: Array<{
    unit: string
    position: string
    string: number
    playerId: string | null
    formation?: string | null
    specialTeamType?: string | null
  }>) => {
    try {
      const response = await fetch("/api/roster/depth-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          entries: updates,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to update depth chart")
      }

      await loadDepthChart()
    } catch (error: any) {
      console.error("Failed to update depth chart:", error)
      alert(`Error updating depth chart: ${error.message || "Unknown error"}`)
    }
  }

  return (
    <div>
      {/* Tab Navigation */}
      <div className="mb-6 border-b border-[#64748B]">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("roster")}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === "roster"
                ? "border-b-2"
                : "opacity-60 hover:opacity-100"
            }`}
            style={activeTab === "roster" ? { borderBottomColor: "#3B82F6", color: "#000000" } : { color: "#000000" }}
          >
            Roster View
          </button>
          {isFootball && (
            <button
              onClick={() => setActiveTab("depth-chart")}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === "depth-chart"
                  ? "border-b-2"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "depth-chart" ? { borderBottomColor: "#3B82F6", color: "#000000" } : { color: "#000000" }}
            >
              Depth Chart
            </button>
          )}
        </div>
      </div>

      {/* Add/Import Controls */}
      {canEdit && activeTab === "roster" && (
        <div className="mb-6 flex gap-4">
          {!showAddForm && !showImportForm && (
            <>
              <Button onClick={() => setShowAddForm(true)}>Add Player</Button>
              <Button variant="outline" onClick={() => setShowImportForm(true)}>Import CSV</Button>
            </>
          )}
        </div>
      )}

      {/* Import Form */}
      {showImportForm && (
        <Card className="mb-6 bg-white border border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0F172A]">Import Players from CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[#111827]">CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="text-[#111827]"
                />
                <p className="text-xs text-[#6B7280]">
                  CSV format: First Name, Last Name, Grade, Jersey Number, Position, Email (optional), Notes (optional)
                </p>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <Button onClick={handleCsvImport} disabled={loading || !csvFile}>
                {loading ? "Importing..." : "Import CSV"}
              </Button>
              <Button variant="outline" onClick={() => setShowImportForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Player Form */}
      {showAddForm && (
        <Card className="mb-6 bg-white border border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0F172A]">Add Player</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#0F172A]">First Name *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Last Name *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Grade</Label>
                <Input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Jersey Number</Label>
                <Input type="number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Position</Label>
                <select
                  value={positionGroup}
                  onChange={(e) => setPositionGroup(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <option value="">Select position</option>
                  <option value="QB">QB</option>
                  <option value="RB">RB</option>
                  <option value="WR">WR</option>
                  <option value="TE">TE</option>
                  <option value="OL">OL</option>
                  <option value="DL">DL</option>
                  <option value="LB">LB</option>
                  <option value="DB">DB</option>
                  <option value="K">K</option>
                  <option value="P">P</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Email (optional - for invite)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-[#0F172A]">Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                  placeholder="Eligibility notes, injuries, etc."
                />
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <Button onClick={handleAddPlayer} disabled={loading}>
                {loading ? "Adding..." : "Add Player"}
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing warning confirmation: coach-created player may become a billable slot when they join */}
      {showBillingWarningModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => !loading && setShowBillingWarningModal(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-white border border-[#E5E7EB]">
              <CardHeader>
                <CardTitle className="text-[#0F172A]">Confirm add player</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[#475569]" style={{ lineHeight: 1.5 }}>
                  {ROSTER_BILLING_WARNING}
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowBillingWarningModal(false)} disabled={loading}>
                    Cancel
                  </Button>
                  <Button onClick={submitAddPlayer} disabled={loading}>
                    {loading ? "Adding..." : "Confirm & add player"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => !loading && setEditingPlayer(null)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <EditPlayerModal
              player={editingPlayer}
              onSave={handleSaveEdit}
              onCancel={() => setEditingPlayer(null)}
              loading={loading}
            />
          </div>
        </>
      )}

      {/* Invite link modal */}
      {inviteModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setInviteModal(null)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <InviteLinkModal
              playerName={`${inviteModal.player.firstName} ${inviteModal.player.lastName}`}
              inviteCode={inviteModal.inviteCode}
              onClose={() => setInviteModal(null)}
            />
          </div>
        </>
      )}

      {/* Content Views */}
      {activeTab === "roster" && (
        <RosterGridView
          players={players}
          canEdit={canEdit}
          onEditPlayer={canEdit ? (p) => setEditingPlayer(p as Player) : undefined}
          onSendInvite={canEdit ? (p) => void handleSendInvite(p as Player) : undefined}
          onDeletePlayer={canEdit ? (p) => void handleDeletePlayer(p as Player) : undefined}
        />
      )}

      {activeTab === "depth-chart" && isFootball && (
        <DepthChartView
          teamId={teamId}
          players={players}
          depthChart={depthChart}
          onUpdate={handleDepthChartUpdate}
          canEdit={canEdit}
          isHeadCoach={userRole === "HEAD_COACH"}
        />
      )}
    </div>
  )
}
