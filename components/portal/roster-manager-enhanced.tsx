"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LayoutGrid, List } from "lucide-react"
import { RosterGridView } from "./roster-grid-view"
import { RosterListView } from "./roster-list-view"
import { DepthChartView } from "./depth-chart-view"
import { RosterPrintModal } from "./roster-print-modal"
import { RosterEmailModal } from "./roster-email-modal"

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
  healthStatus?: "active" | "injured" | "unavailable"
  weight?: number | null
  height?: string | null
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
    weight?: number | null
    height?: string | null
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
  const [weight, setWeight] = useState(player.weight != null ? String(player.weight) : "")
  const [height, setHeight] = useState(player.height ?? "")

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
      weight: weight === "" ? null : parseInt(weight, 10),
      height: height.trim() || null,
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
          <div className="space-y-2">
            <Label className="text-[#0F172A]">Weight (lbs)</Label>
            <Input type="number" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 185" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#0F172A]">Height</Label>
            <Input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 5'10&quot; or 6-2" />
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

// Helper function to determine if a position is offense or defense
function getPositionSide(positionGroup: string | null): "offense" | "defense" | "special" | null {
  if (!positionGroup) return null
  const offensePositions = ["QB", "RB", "WR", "TE", "OL"]
  const defensePositions = ["DL", "LB", "DB"]
  const specialPositions = ["K", "P"]
  
  if (offensePositions.includes(positionGroup.toUpperCase())) return "offense"
  if (defensePositions.includes(positionGroup.toUpperCase())) return "defense"
  if (specialPositions.includes(positionGroup.toUpperCase())) return "special"
  return null
}

// Helper function to map grade string to number (High School: 9-12, College: 1-4)
function gradeStringToNumber(gradeStr: string, isCollege: boolean = false): number | null {
  const gradeMap: Record<string, number> = isCollege
    ? { Freshman: 1, Sophomore: 2, Junior: 3, Senior: 4 }
    : { Freshman: 9, Sophomore: 10, Junior: 11, Senior: 12 }
  return gradeMap[gradeStr] ?? null
}

function AddPlayerModal({
  onSave,
  onCancel,
  loading,
  existingPlayers,
}: {
  onSave: (payload: {
    firstName: string
    lastName: string
    grade: number | null
    jerseyNumber: number | null
    positionGroup: string | null
    notes: string | null
    email?: string | null
    weight?: number | null
    height?: string | null
  }) => void
  onCancel: () => void
  loading: boolean
  existingPlayers: Player[]
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [grade, setGrade] = useState("")
  const [jerseyNumber, setJerseyNumber] = useState("")
  const [positionGroup, setPositionGroup] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [weight, setWeight] = useState("")
  const [height, setHeight] = useState("")
  const [jerseyError, setJerseyError] = useState<string | null>(null)

  // Validate jersey number when it changes
  useEffect(() => {
    setJerseyError(null)
    if (!jerseyNumber || !positionGroup) return

    const num = parseInt(jerseyNumber, 10)
    if (isNaN(num) || num < 0 || num > 99) {
      setJerseyError("Jersey number must be between 0 and 99")
      return
    }

    const newPlayerSide = getPositionSide(positionGroup)
    if (!newPlayerSide || newPlayerSide === "special") return // Special teams can share numbers

    // Check for conflicts with existing players
    const conflictingPlayer = existingPlayers.find((p) => {
      if (p.jerseyNumber !== num) return false
      if (!p.positionGroup) return false
      const existingSide = getPositionSide(p.positionGroup)
      // Conflict if both are offense or both are defense
      return existingSide === newPlayerSide
    })

    if (conflictingPlayer) {
      setJerseyError(
        `Jersey number ${num} is already used by ${conflictingPlayer.firstName} ${conflictingPlayer.lastName} (${conflictingPlayer.positionGroup}). Two players with the same number cannot both be on the same side (offense/defense).`
      )
    }
  }, [jerseyNumber, positionGroup, existingPlayers])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      alert("First and last name are required")
      return
    }
    if (jerseyError) {
      alert(jerseyError)
      return
    }
    
    // Convert grade string to number (assuming high school for now)
    const gradeNum = grade ? gradeStringToNumber(grade, false) : null
    
    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      grade: gradeNum,
      jerseyNumber: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
      positionGroup: positionGroup.trim() || null,
      notes: notes.trim() || null,
      email: email.trim() || null,
      weight: weight === "" ? null : parseInt(weight, 10),
      height: height.trim() || null,
    })
  }

  return (
    <Card className="w-full max-w-2xl bg-white border border-[#E5E7EB]" onClick={(e) => e.stopPropagation()}>
      <CardHeader>
        <CardTitle className="text-[#0F172A]">Add Player</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label className="text-[#0F172A]">First Name *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label className="text-[#0F172A]">Last Name *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label className="text-[#0F172A]">Grade</Label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="flex h-11 w-full rounded-lg border-2 bg-white px-4 py-2.5 text-sm text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2A5B] focus-visible:ring-offset-2"
              style={{ borderColor: "#0B2A5B" }}
            >
              <option value="">Select grade</option>
              <option value="Freshman">Freshman</option>
              <option value="Sophomore">Sophomore</option>
              <option value="Junior">Junior</option>
              <option value="Senior">Senior</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#0F172A]">Jersey Number</Label>
            <Input
              type="number"
              min="0"
              max="99"
              value={jerseyNumber}
              onChange={(e) => {
                const val = e.target.value
                if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 99)) {
                  setJerseyNumber(val)
                }
              }}
              placeholder="0-99"
            />
            {jerseyError && (
              <p className="text-xs text-red-600 mt-1">{jerseyError}</p>
            )}
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-[#0F172A]">Position</Label>
            <select
              value={positionGroup}
              onChange={(e) => setPositionGroup(e.target.value)}
              className="flex h-11 w-full rounded-lg border-2 bg-white px-4 py-2.5 text-sm text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2A5B] focus-visible:ring-offset-2"
              style={{ borderColor: "#0B2A5B" }}
            >
              <option value="">Select position</option>
              <optgroup label="Offense">
                <option value="QB">QB</option>
                <option value="RB">RB</option>
                <option value="WR">WR</option>
                <option value="TE">TE</option>
                <option value="OL">OL</option>
              </optgroup>
              <optgroup label="Defense">
                <option value="DL">DL</option>
                <option value="LB">LB</option>
                <option value="DB">DB</option>
              </optgroup>
              <optgroup label="Special Teams">
                <option value="K">K</option>
                <option value="P">P</option>
              </optgroup>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#0F172A]">Weight (lbs)</Label>
            <Input type="number" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 185" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#0F172A]">Height</Label>
            <Input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 5'10&quot; or 6-2" />
          </div>
          <div className="space-y-2 col-span-2">
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
          <div className="col-span-2 flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !!jerseyError}>
              {loading ? "Adding..." : "Add Player"}
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
  const [depthChartSnapshot, setDepthChartSnapshot] = useState<DepthChartEntry[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDepthChartModal, setShowDepthChartModal] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportForm, setShowImportForm] = useState(false)

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [showBillingWarningModal, setShowBillingWarningModal] = useState(false)
  const [pendingPlayerData, setPendingPlayerData] = useState<{
    firstName: string
    lastName: string
    grade: number | null
    jerseyNumber: number | null
    positionGroup: string | null
    notes: string | null
    email?: string | null
  } | null>(null)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [inviteModal, setInviteModal] = useState<{ player: Player; inviteCode: string } | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [rosterViewMode, setRosterViewMode] = useState<"card" | "list">("card")

  const isFootball = teamSport?.toLowerCase() === "football"

  // Load depth chart data when modal opens
  useEffect(() => {
    if (isFootball && showDepthChartModal) {
      loadDepthChart()
    }
  }, [teamId, isFootball, showDepthChartModal])

  const loadDepthChart = async () => {
    try {
      const response = await fetch(`/api/roster/depth-chart?teamId=${teamId}`)
      if (response.ok) {
        const data = await response.json()
        const entries = (data.entries || []).map((e: DepthChartEntry) => {
          // Ensure player object is populated if playerId exists
          if (e.playerId && !e.player) {
            const player = players.find(p => p.id === e.playerId)
            return { ...e, player: player || null }
          }
          return e
        })
        setDepthChart(entries)
        setDepthChartSnapshot(JSON.parse(JSON.stringify(entries))) // Deep copy for comparison
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error("Failed to load depth chart:", error)
    }
  }

  const handleOpenDepthChart = () => {
    setShowDepthChartModal(true)
    setActiveTab("depth-chart")
  }

  const handleCloseDepthChart = () => {
    if (hasUnsavedChanges) {
      setShowSavePrompt(true)
    } else {
      setShowDepthChartModal(false)
      setActiveTab("roster")
    }
  }

  const handleSaveAndClose = async () => {
    await handleSaveDepthChart()
    setShowSavePrompt(false)
    setShowDepthChartModal(false)
    setActiveTab("roster")
  }

  const handleDiscardAndClose = () => {
    // Reload from snapshot to discard changes
    setDepthChart(JSON.parse(JSON.stringify(depthChartSnapshot)))
    setShowSavePrompt(false)
    setShowDepthChartModal(false)
    setHasUnsavedChanges(false)
    setActiveTab("roster")
  }

  const handleAddPlayerSave = (payload: {
    firstName: string
    lastName: string
    grade: number | null
    jerseyNumber: number | null
    positionGroup: string | null
    notes: string | null
    email?: string | null
  }) => {
    setPendingPlayerData(payload)
    setShowBillingWarningModal(true)
    setShowAddModal(false)
  }

  const submitAddPlayer = async () => {
    if (!pendingPlayerData) return
    setLoading(true)
    setShowBillingWarningModal(false)
    try {
      const response = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          ...pendingPlayerData,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to add player")
      }
      const newPlayer = data as Player
      setPlayers([...players, newPlayer])
      setPendingPlayerData(null)
      setShowAddModal(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error adding player")
      // Reopen modal on error
      setShowAddModal(true)
    } finally {
      setLoading(false)
    }
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
    weight?: number | null
    height?: string | null
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
          weight: payload.weight ?? undefined,
          height: payload.height ?? undefined,
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
    const response = await fetch(`/api/roster/depth-chart?teamId=${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: updates,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || "Failed to update depth chart")
    }
  }

  // Track changes to depth chart (apply locally, mark as unsaved)
  const handleDepthChartChange = (updates: Array<{
    unit: string
    position: string
    string: number
    playerId: string | null
    formation?: string | null
    specialTeamType?: string | null
  }>) => {
    // Apply changes locally
    const updatedChart = [...depthChart]
    
    updates.forEach((update) => {
      // Remove entries that match this position/string
      const indicesToRemove: number[] = []
      updatedChart.forEach((e, idx) => {
        if (
          e.unit === update.unit &&
          e.position === update.position &&
          e.string === update.string &&
          (update.specialTeamType
            ? e.specialTeamType === update.specialTeamType
            : !e.specialTeamType && !e.formation)
        ) {
          indicesToRemove.push(idx)
        }
      })
      
      // Remove in reverse order to maintain indices
      indicesToRemove.reverse().forEach(idx => updatedChart.splice(idx, 1))
      
      // Add new entry if playerId is not null
      if (update.playerId) {
        // Find the player object to attach to the entry
        const player = players.find(p => p.id === update.playerId)
        updatedChart.push({
          id: `temp-${Date.now()}-${Math.random()}`,
          unit: update.unit,
          position: update.position,
          string: update.string,
          playerId: update.playerId,
          player: player || null,
          formation: update.formation || null,
          specialTeamType: update.specialTeamType || null,
        })
      }
    })

    setDepthChart(updatedChart)
    setHasUnsavedChanges(true)
  }

  const handleSaveDepthChart = async () => {
    // Get all current entries and save them
    const updates = depthChart.map((e) => ({
      unit: e.unit,
      position: e.position,
      string: e.string,
      playerId: e.playerId,
      formation: e.formation || null,
      specialTeamType: e.specialTeamType || null,
    }))

    try {
      await handleDepthChartUpdate(updates)
      
      // Reload to get saved state
      const reloadResponse = await fetch(`/api/roster/depth-chart?teamId=${teamId}`)
      if (reloadResponse.ok) {
        const data = await reloadResponse.json()
        const entries = (data.entries || []).map((e: DepthChartEntry) => {
          // Ensure player object is populated if playerId exists
          if (e.playerId && !e.player) {
            const player = players.find(p => p.id === e.playerId)
            return { ...e, player: player || null }
          }
          return e
        })
        setDepthChart(entries)
        setDepthChartSnapshot(JSON.parse(JSON.stringify(entries)))
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error("Failed to save depth chart:", error)
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
              onClick={handleOpenDepthChart}
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

      {/* Add/Import Controls + View Toggle */}
      {activeTab === "roster" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#64748B]">View:</span>
            <div className="flex rounded-lg border border-[#E5E7EB] bg-white p-0.5">
              <button
                type="button"
                onClick={() => setRosterViewMode("card")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  rosterViewMode === "card"
                    ? "bg-[#3B82F6] text-white shadow-sm"
                    : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
                aria-pressed={rosterViewMode === "card"}
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setRosterViewMode("list")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  rosterViewMode === "list"
                    ? "bg-[#3B82F6] text-white shadow-sm"
                    : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
                aria-pressed={rosterViewMode === "list"}
              >
                <List className="h-4 w-4" />
                List
              </button>
            </div>
          </div>
          {canEdit && !showAddModal && !showImportForm && !showPrintModal && !showEmailModal && (
            <div className="flex gap-2">
              <Button onClick={() => setShowAddModal(true)}>Add Player</Button>
              <Button variant="outline" onClick={() => setShowImportForm(true)}>Import CSV</Button>
              <Button variant="outline" onClick={() => setShowPrintModal(true)}>Print Roster</Button>
              <Button variant="outline" onClick={() => setShowEmailModal(true)}>Email Roster</Button>
            </div>
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

      {/* Add Player Modal */}
      {showAddModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => !loading && setShowAddModal(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <AddPlayerModal
              onSave={handleAddPlayerSave}
              onCancel={() => setShowAddModal(false)}
              loading={loading}
              existingPlayers={players}
            />
          </div>
        </>
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
      {activeTab === "roster" && !showPrintModal && !showEmailModal && (
        rosterViewMode === "card" ? (
          <RosterGridView
            players={players}
            canEdit={canEdit}
            onEditPlayer={canEdit ? (p) => setEditingPlayer(p as Player) : undefined}
            onSendInvite={canEdit ? (p) => void handleSendInvite(p as Player) : undefined}
            onDeletePlayer={canEdit ? (p) => void handleDeletePlayer(p as Player) : undefined}
          />
        ) : (
          <RosterListView
            players={players}
            canEdit={canEdit}
            onEditPlayer={canEdit ? (p) => setEditingPlayer(p as Player) : undefined}
            onSendInvite={canEdit ? (p) => void handleSendInvite(p as Player) : undefined}
            onDeletePlayer={canEdit ? (p) => void handleDeletePlayer(p as Player) : undefined}
          />
        )
      )}

      {/* Print Modal */}
      {showPrintModal && (
        <RosterPrintModal teamId={teamId} onClose={() => setShowPrintModal(false)} />
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <RosterEmailModal teamId={teamId} onClose={() => setShowEmailModal(false)} />
      )}

      {/* Depth Chart Full-Screen Modal */}
      {showDepthChartModal && isFootball && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" aria-hidden />
          <div className="fixed inset-0 z-50 flex flex-col bg-white">
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] bg-white">
              <h2 className="text-2xl font-semibold text-[#0F172A]">Depth Chart</h2>
              <div className="flex items-center gap-3">
                {hasUnsavedChanges && (
                  <span className="text-sm text-amber-600 font-medium">Unsaved changes</span>
                )}
                {hasUnsavedChanges && (
                  <Button onClick={handleSaveDepthChart} variant="default">
                    Save
                  </Button>
                )}
                <Button variant="outline" onClick={handleCloseDepthChart}>
                  Close
                </Button>
              </div>
            </div>
            {/* Full-screen depth chart content */}
            <div className="flex-1 overflow-auto">
              <DepthChartView
                teamId={teamId}
                players={players}
                depthChart={depthChart}
                onUpdate={handleDepthChartChange}
                canEdit={canEdit}
                isHeadCoach={userRole === "HEAD_COACH"}
              />
            </div>
          </div>
        </>
      )}

      {/* Save Prompt Modal */}
      {showSavePrompt && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setShowSavePrompt(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-white border border-[#E5E7EB]" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle className="text-[#0F172A]">Unsaved Changes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[#475569]">
                  You have unsaved changes to the depth chart. What would you like to do?
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={handleDiscardAndClose}>
                    Discard Changes
                  </Button>
                  <Button onClick={handleSaveAndClose}>
                    Save & Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
