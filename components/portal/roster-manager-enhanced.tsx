"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LayoutGrid, List, ClipboardCheck, AlertCircle, History, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
  initialView?: "card" | "list"
  initialSearch?: string
  initialPosition?: string
}

type TeamReadinessSummary = {
  total: number
  readyCount: number
  incompleteCount: number
  missingPhysicalCount: number
  missingWaiverCount: number
  incompleteProfileCount: number
  noEquipmentCount: number
  eligibilityMissingCount: number
  noGuardiansCount: number
}

type PlayerReadinessItem = {
  playerId: string
  firstName: string
  lastName: string
  ready: boolean
  profileComplete: boolean
  physicalOnFile: boolean
  waiverOnFile: boolean
  requiredDocsComplete: boolean
  equipmentAssigned: boolean
  assignedEquipmentCount: number
  eligibilityStatus: string | null
  hasGuardians: boolean
  missingItems: string[]
}

const TEAM_ACTIVITY_LABELS: Record<string, string> = {
  profile_updated: "Profile updated",
  stats_updated: "Stats updated",
  photo_changed: "Photo changed",
  photo_removed: "Photo removed",
  document_uploaded: "Document uploaded",
  document_deleted: "Document removed",
  equipment_assigned: "Equipment assigned",
  equipment_unassigned: "Equipment unassigned",
  follow_up_created: "Follow-up added",
  follow_up_resolved: "Follow-up resolved",
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
  userRole,
  initialView = "card",
  initialSearch = "",
  initialPosition = "",
}: RosterManagerEnhancedProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [players, setPlayers] = useState(initialPlayers)
  const [activeTab, setActiveTab] = useState<"roster" | "depth-chart" | "readiness">("roster")
  const [teamReadiness, setTeamReadiness] = useState<{
    summary: TeamReadinessSummary
    players: PlayerReadinessItem[]
  } | null>(null)
  const [readinessFilter, setReadinessFilter] = useState<string>("all")
  const [teamActivity, setTeamActivity] = useState<Array<{
    id: string
    playerId: string
    playerName: string
    actionType: string
    createdAt: string
    actor: { name: string | null; email: string } | null
  }>>([])
  const [teamActivityLoading, setTeamActivityLoading] = useState(false)
  const [teamOpenFollowUps, setTeamOpenFollowUps] = useState<Array<{ id: string; playerId: string; category: string }>>([])
  const [depthChart, setDepthChart] = useState<DepthChartEntry[]>([])
  const [depthChartSnapshot, setDepthChartSnapshot] = useState<DepthChartEntry[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDepthChartModal, setShowDepthChartModal] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportForm, setShowImportForm] = useState(false)

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importMode, setImportMode] = useState<"create_only" | "create_or_update" | "replace_roster">("create_only")
  const [lastImportResult, setLastImportResult] = useState<{
    summary: { totalRows: number; created: number; updated?: number; replaced?: number; skipped: number; conflicts: number }
    conflicts: Array<{ row: number; reason: string }>
    skippedRows: Array<{ row: number; reason: string }>
    parseErrors?: Array<{ row: number; message: string }>
  } | null>(null)
  const [showReplaceConfirmModal, setShowReplaceConfirmModal] = useState(false)
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
  const [rosterViewMode, setRosterViewMode] = useState<"card" | "list">(initialView)
  const [rosterSearchQuery, setRosterSearchQuery] = useState(initialSearch)
  const [rosterPositionFilter, setRosterPositionFilter] = useState<string>(initialPosition)

  useEffect(() => {
    setRosterViewMode(initialView)
    setRosterSearchQuery(initialSearch)
    setRosterPositionFilter(initialPosition)
  }, [initialView, initialSearch, initialPosition])

  const syncRosterParamsToUrl = useMemo(() => {
    return (view: "card" | "list", q: string, position: string) => {
      const p = new URLSearchParams()
      p.set("teamId", teamId)
      if (view) p.set("view", view)
      if (q) p.set("q", q)
      if (position) p.set("position", position)
      const query = p.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }
  }, [teamId, pathname, router])

  useEffect(() => {
    syncRosterParamsToUrl(rosterViewMode, rosterSearchQuery.trim(), rosterPositionFilter)
  }, [rosterViewMode, rosterPositionFilter, syncRosterParamsToUrl])

  useEffect(() => {
    if (!canEdit || !teamId) return
    fetch(`/api/teams/${teamId}/readiness`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { summary: TeamReadinessSummary; players: PlayerReadinessItem[] } | null) =>
        data ? setTeamReadiness({ summary: data.summary, players: data.players }) : setTeamReadiness(null)
      )
      .catch(() => setTeamReadiness(null))
  }, [canEdit, teamId, players.length])

  useEffect(() => {
    if (!canEdit || !teamId || activeTab !== "readiness") return
    setTeamActivityLoading(true)
    fetch(`/api/teams/${teamId}/activity?limit=15`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ id: string; playerId: string; playerName: string; actionType: string; createdAt: string; actor: { name: string | null; email: string } | null }>) =>
        setTeamActivity(Array.isArray(data) ? data : [])
      )
      .catch(() => setTeamActivity([]))
      .finally(() => setTeamActivityLoading(false))
  }, [canEdit, teamId, activeTab])

  useEffect(() => {
    if (!canEdit || !teamId || activeTab !== "readiness") return
    fetch(`/api/teams/${teamId}/follow-ups?status=open`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ id: string; playerId: string; category: string }>) =>
        setTeamOpenFollowUps(Array.isArray(data) ? data : [])
      )
      .catch(() => setTeamOpenFollowUps([]))
  }, [canEdit, teamId, activeTab])

  const isFootball = teamSport?.toLowerCase() === "football"

  const readinessFilteredPlayerIds = useMemo(() => {
    if (!teamReadiness || readinessFilter === "all") return null
    const list = teamReadiness.players
    if (readinessFilter === "ready") return new Set(list.filter((p) => p.ready).map((p) => p.playerId))
    if (readinessFilter === "incomplete") return new Set(list.filter((p) => !p.ready).map((p) => p.playerId))
    if (readinessFilter === "missing_physical") return new Set(list.filter((p) => !p.physicalOnFile).map((p) => p.playerId))
    if (readinessFilter === "missing_waiver") return new Set(list.filter((p) => !p.waiverOnFile).map((p) => p.playerId))
    if (readinessFilter === "incomplete_profile") return new Set(list.filter((p) => !p.profileComplete).map((p) => p.playerId))
    if (readinessFilter === "no_equipment") return new Set(list.filter((p) => !p.equipmentAssigned).map((p) => p.playerId))
    if (readinessFilter === "no_guardians") return new Set(list.filter((p) => !p.hasGuardians).map((p) => p.playerId))
    if (readinessFilter === "eligibility_missing") return new Set(list.filter((p) => !p.eligibilityStatus?.trim()).map((p) => p.playerId))
    return null
  }, [teamReadiness, readinessFilter])

  const filteredRosterPlayers = useMemo(() => {
    let list = players
    if (readinessFilteredPlayerIds) {
      list = list.filter((p) => readinessFilteredPlayerIds.has(p.id))
    }
    const q = rosterSearchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          (p.firstName?.toLowerCase() ?? "").includes(q) ||
          (p.lastName?.toLowerCase() ?? "").includes(q) ||
          `${(p.firstName ?? "").toLowerCase()} ${(p.lastName ?? "").toLowerCase()}`.includes(q) ||
          `${(p.lastName ?? "").toLowerCase()} ${(p.firstName ?? "").toLowerCase()}`.includes(q)
      )
    }
    if (rosterPositionFilter) {
      list = list.filter((p) => (p.positionGroup?.toUpperCase() ?? "") === rosterPositionFilter.toUpperCase())
    }
    return list
  }, [players, rosterSearchQuery, rosterPositionFilter, readinessFilteredPlayerIds])

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

  const runCsvImport = async () => {
    if (!csvFile) return

    setLoading(true)
    setLastImportResult(null)
    try {
      const formData = new FormData()
      formData.append("file", csvFile)
      formData.append("teamId", teamId)
      formData.append("importMode", importMode)

      const response = await fetch("/api/roster/import", {
        method: "POST",
        body: formData,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Failed to import CSV")
      }

      if (data.summary) {
        setLastImportResult({
          summary: data.summary,
          conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
          skippedRows: Array.isArray(data.skippedRows) ? data.skippedRows : [],
          parseErrors: Array.isArray(data.parseErrors) ? data.parseErrors : undefined,
        })
      }

      if (importMode === "replace_roster" || importMode === "create_or_update") {
        const rosterRes = await fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}`)
        if (rosterRes.ok) {
          const rosterData = await rosterRes.json()
          const list = Array.isArray(rosterData) ? rosterData : []
          setPlayers(list.map((p: Record<string, unknown>) => ({
            ...p,
            guardianLinks: Array.isArray(p.guardianLinks) ? p.guardianLinks : [],
          })) as Player[])
        } else {
          setPlayers([...players, ...(Array.isArray(data.players) ? data.players : [])])
        }
      } else {
        setPlayers([...players, ...(Array.isArray(data.players) ? data.players : [])])
      }
      setCsvFile(null)
      setShowImportForm(false)
      setShowReplaceConfirmModal(false)
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Error importing CSV")
    } finally {
      setLoading(false)
    }
  }

  const handleCsvImport = () => {
    if (!csvFile) {
      alert("Please select a CSV file")
      return
    }
    if (importMode === "replace_roster") {
      setShowReplaceConfirmModal(true)
      return
    }
    void runCsvImport()
  }

  const handleConfirmReplaceRoster = () => {
    setShowReplaceConfirmModal(false)
    void runCsvImport()
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

  const handlePlayerImageUploaded = (playerId: string, imageUrl: string) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, imageUrl } : p))
    )
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
        <div className="flex flex-wrap gap-4">
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
          {canEdit && (
            <button
              onClick={() => setActiveTab("readiness")}
              className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors ${
                activeTab === "readiness"
                  ? "border-b-2"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "readiness" ? { borderBottomColor: "#3B82F6", color: "#000000" } : { color: "#000000" }}
            >
              <ClipboardCheck className="h-4 w-4" />
              Readiness
            </button>
          )}
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
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              placeholder="Search by name..."
              value={rosterSearchQuery}
              onChange={(e) => setRosterSearchQuery(e.target.value)}
              className="max-w-[220px] h-9 text-sm"
            />
            <select
              value={rosterPositionFilter}
              onChange={(e) => setRosterPositionFilter(e.target.value)}
              className="h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              aria-label="Filter by position"
            >
              <option value="">All positions</option>
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
              <optgroup label="Special">
                <option value="K">K</option>
                <option value="P">P</option>
              </optgroup>
            </select>
            {canEdit && teamReadiness && (
              <select
                value={readinessFilter}
                onChange={(e) => setReadinessFilter(e.target.value)}
                className="h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                aria-label="Filter by readiness"
              >
                <option value="all">All readiness</option>
                <option value="ready">Ready</option>
                <option value="incomplete">Incomplete</option>
                <option value="missing_physical">Missing physical</option>
                <option value="missing_waiver">Missing waiver</option>
                <option value="incomplete_profile">Incomplete profile</option>
                <option value="no_equipment">No equipment</option>
                <option value="no_guardians">No guardians linked</option>
                <option value="eligibility_missing">Eligibility not set</option>
              </select>
            )}
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

      {/* Team Readiness Dashboard */}
      {activeTab === "readiness" && (
        <div className="space-y-6">
          {!teamReadiness ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3B82F6] border-t-transparent" />
            </div>
          ) : teamReadiness.summary.total === 0 ? (
            <Card className="border border-[#E5E7EB] bg-white">
              <CardContent className="py-12 text-center">
                <ClipboardCheck className="mx-auto h-12 w-12 text-[#94A3B8]" />
                <p className="mt-4 text-sm font-medium text-[#64748B]">No players on roster</p>
                <p className="mt-1 text-sm text-[#94A3B8]">Add players to see readiness summary.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <Card className="border border-[#E5E7EB] bg-white">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Total</p>
                    <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{teamReadiness.summary.total}</p>
                  </CardContent>
                </Card>
                <Card className="border border-emerald-200 bg-emerald-50/50">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Ready</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-800">{teamReadiness.summary.readyCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-amber-200 bg-amber-50/50">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Incomplete</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-800">{teamReadiness.summary.incompleteCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E5E7EB] bg-white">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Missing physical</p>
                    <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{teamReadiness.summary.missingPhysicalCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E5E7EB] bg-white">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Missing waiver</p>
                    <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{teamReadiness.summary.missingWaiverCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E5E7EB] bg-white">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Incomplete profile</p>
                    <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{teamReadiness.summary.incompleteProfileCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E5E7EB] bg-white">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">No equipment</p>
                    <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{teamReadiness.summary.noEquipmentCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E5E7EB] bg-white">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">No guardians</p>
                    <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{teamReadiness.summary.noGuardiansCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E5E7EB] bg-white">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Eligibility not set</p>
                    <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{teamReadiness.summary.eligibilityMissingCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#E5E7EB] bg-white">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Open follow-ups</p>
                    <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{teamOpenFollowUps.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-[#E5E7EB] bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#0F172A]">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Needs attention
                  </CardTitle>
                  <p className="text-sm text-[#64748B]">Players with missing items. Click a row to open profile.</p>
                </CardHeader>
                <CardContent>
                  {teamReadiness.players.filter((p) => !p.ready || p.missingItems.length > 0).length === 0 ? (
                    <p className="py-6 text-center text-sm text-[#64748B]">All players are ready.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-left text-[#64748B]">
                            <th className="pb-2 pr-4 font-medium">Player</th>
                            <th className="pb-2 pr-4 font-medium">Status</th>
                            <th className="pb-2 pr-4 font-medium">Missing</th>
                            {canEdit && <th className="pb-2 font-medium">Follow-ups</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {teamReadiness.players
                            .filter((p) => !p.ready || p.missingItems.length > 0)
                            .map((p) => {
                              const params = new URLSearchParams()
                              params.set("teamId", teamId)
                              const profileHref = `/dashboard/roster/${p.playerId}?${params.toString()}`
                              const openCount = teamOpenFollowUps.filter((f) => f.playerId === p.playerId).length
                              return (
                                <tr
                                  key={p.playerId}
                                  className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]"
                                >
                                  <td className="py-3 pr-4">
                                    <Link
                                      href={profileHref}
                                      className="font-medium text-[#3B82F6] hover:underline"
                                    >
                                      {p.firstName} {p.lastName}
                                    </Link>
                                    {!p.hasGuardians && (
                                      <span className="ml-1.5 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800" title="No guardians linked">No guardians</span>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4">
                                    {p.ready ? (
                                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Ready</span>
                                    ) : (
                                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Incomplete</span>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4 text-[#64748B]">{p.missingItems.join(", ") || "—"}</td>
                                  {canEdit && (
                                    <td className="py-3">
                                      {openCount > 0 ? (
                                        <span className="text-amber-700 text-xs font-medium">{openCount} open</span>
                                      ) : null}
                                      <Link
                                        href={profileHref}
                                        className="ml-2 text-xs text-[#3B82F6] hover:underline"
                                      >
                                        Add follow-up
                                      </Link>
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!teamReadiness) return
                    const headers = ["First Name", "Last Name", "Ready", "Profile Complete", "Physical", "Waiver", "Equipment", "Guardians", "Eligibility", "Open Follow-ups", "Missing Items"]
                    const rows = teamReadiness.players.map((p) => [
                      p.firstName,
                      p.lastName,
                      p.ready ? "Yes" : "No",
                      p.profileComplete ? "Yes" : "No",
                      p.physicalOnFile ? "Yes" : "No",
                      p.waiverOnFile ? "Yes" : "No",
                      p.equipmentAssigned ? "Yes" : "No",
                      p.hasGuardians ? "Yes" : "No",
                      p.eligibilityStatus ?? "",
                      String(teamOpenFollowUps.filter((f) => f.playerId === p.playerId).length),
                      p.missingItems.join("; ") || "",
                    ])
                    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `roster-readiness-${teamId}-${new Date().toISOString().slice(0, 10)}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  Export readiness (CSV)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!teamReadiness) return
                    const incomplete = teamReadiness.players.filter((p) => !p.ready)
                    const headers = ["First Name", "Last Name", "Profile Complete", "Physical", "Waiver", "Equipment", "Guardians", "Eligibility", "Open Follow-ups", "Missing Items"]
                    const rows = incomplete.map((p) => [
                      p.firstName,
                      p.lastName,
                      p.profileComplete ? "Yes" : "No",
                      p.physicalOnFile ? "Yes" : "No",
                      p.waiverOnFile ? "Yes" : "No",
                      p.equipmentAssigned ? "Yes" : "No",
                      p.hasGuardians ? "Yes" : "No",
                      p.eligibilityStatus ?? "",
                      String(teamOpenFollowUps.filter((f) => f.playerId === p.playerId).length),
                      p.missingItems.join("; ") || "",
                    ])
                    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `roster-incomplete-${teamId}-${new Date().toISOString().slice(0, 10)}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  Export incomplete only (CSV)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReadinessFilter("incomplete")
                    setActiveTab("roster")
                  }}
                >
                  Show incomplete in roster
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReadinessFilter("all")
                    setActiveTab("roster")
                  }}
                >
                  Back to full roster
                </Button>
              </div>

              <Card className="border border-[#E5E7EB] bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#0F172A]">
                    <History className="h-5 w-5 text-[#64748B]" />
                    Recent team activity
                  </CardTitle>
                  <p className="text-sm text-[#64748B]">Latest profile changes across the roster.</p>
                </CardHeader>
                <CardContent>
                  {teamActivityLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" />
                    </div>
                  ) : teamActivity.length === 0 ? (
                    <p className="py-4 text-center text-sm text-[#64748B]">No recent activity.</p>
                  ) : (
                    <ul className="space-y-2">
                      {teamActivity.map((a) => {
                        const profileHref = `/dashboard/roster/${a.playerId}?teamId=${encodeURIComponent(teamId)}`
                        const label = TEAM_ACTIVITY_LABELS[a.actionType] ?? a.actionType
                        const timeAgo = (() => {
                          const d = new Date(a.createdAt)
                          const now = new Date()
                          const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000)
                          const diffHours = Math.floor(diffMins / 60)
                          const diffDays = Math.floor(diffHours / 24)
                          if (diffMins < 1) return "Just now"
                          if (diffMins < 60) return `${diffMins}m ago`
                          if (diffHours < 24) return `${diffHours}h ago`
                          if (diffDays < 7) return `${diffDays}d ago`
                          return d.toLocaleDateString()
                        })()
                        return (
                          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#F1F5F9] px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <Link href={profileHref} className="font-medium text-[#3B82F6] hover:underline">
                                {a.playerName}
                              </Link>
                              <span className="ml-2 text-[#64748B]">— {label}</span>
                              {a.actor?.name && <span className="ml-1 text-xs text-[#94A3B8]">by {a.actor.name}</span>}
                            </div>
                            <span className="text-xs text-[#94A3B8] shrink-0">{timeAgo}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
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
                <Label className="text-[#111827]">Import mode</Label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as "create_only" | "create_or_update" | "replace_roster")}
                  className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-[#111827] ${
                    importMode === "replace_roster"
                      ? "border-red-300 bg-red-50/50 focus-visible:ring-red-500"
                      : "border-[#E5E7EB]"
                  }`}
                >
                  <option value="create_only">Create only (add new players; skip or duplicate if already exist)</option>
                  <option value="create_or_update">Create or update (match by email or name + jersey, update existing)</option>
                  <option value="replace_roster">Replace roster (remove all current players, then add from CSV)</option>
                </select>
                <p className="text-xs text-[#6B7280]">
                  {importMode === "create_only" && "Adds new players only; existing players are left unchanged."}
                  {importMode === "create_or_update" && "Updates matched players and creates new ones; no rows are deleted."}
                  {importMode === "replace_roster" && (
                    <span className="text-red-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Removes the current roster and related player-linked records, then imports from CSV. This cannot be undone.
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-[#111827]">CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="text-[#111827]"
                />
                <p className="text-xs text-[#6B7280]">
                  CSV format: First Name, Last Name, Grade, Jersey Number, Position, Email (optional), Notes (optional), Weight (optional), Height (optional)
                </p>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <Button onClick={handleCsvImport} disabled={loading || !csvFile}>
                {loading ? "Importing..." : "Import CSV"}
              </Button>
              <Button variant="outline" onClick={() => setShowImportForm(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Replace roster confirmation modal */}
      <Dialog open={showReplaceConfirmModal} onOpenChange={setShowReplaceConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Replace entire roster?
            </DialogTitle>
            <DialogDescription className="text-[#475569]">
              This action will remove the current team roster and all related player-linked records (e.g. assignments, follow-ups) before importing the new CSV. This cannot be undone. Do you want to continue?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowReplaceConfirmModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmReplaceRoster} disabled={loading}>
              {loading ? "Importing..." : "Confirm & replace roster"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import result summary (after successful import) */}
      {lastImportResult && !showImportForm && (
        <Card className="mb-6 bg-[#F0FDF4] border border-[#86EFAC]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-[#166534]">Import complete</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLastImportResult(null)} aria-label="Dismiss">
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[#166534]">
            {/* Summary */}
            <section>
              <h4 className="font-semibold text-[#166534] mb-1">Summary</h4>
              <p>
                {lastImportResult.summary.totalRows != null && `${lastImportResult.summary.totalRows} rows processed. `}
                {lastImportResult.summary.created} created
                {lastImportResult.summary.updated != null && lastImportResult.summary.updated > 0 && `, ${lastImportResult.summary.updated} updated`}
                {lastImportResult.summary.replaced != null && lastImportResult.summary.replaced > 0 && `, ${lastImportResult.summary.replaced} replaced`}
                {lastImportResult.summary.skipped > 0 && `, ${lastImportResult.summary.skipped} skipped`}
                {lastImportResult.summary.conflicts > 0 && `, ${lastImportResult.summary.conflicts} conflicts`}.
              </p>
            </section>
            {/* Parsing issues */}
            {lastImportResult.parseErrors && lastImportResult.parseErrors.length > 0 && (
              <section className="rounded bg-amber-50 border border-amber-200 p-3 text-amber-900">
                <h4 className="font-semibold mb-1">CSV parsing issues</h4>
                <ul className="list-disc list-inside space-y-0.5">
                  {lastImportResult.parseErrors.slice(0, 15).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                  {lastImportResult.parseErrors.length > 15 && (
                    <li>… and {lastImportResult.parseErrors.length - 15} more</li>
                  )}
                </ul>
              </section>
            )}
            {/* Conflicts */}
            {lastImportResult.conflicts.length > 0 && (
              <section className="rounded bg-amber-50 border border-amber-200 p-3 text-amber-900">
                <h4 className="font-semibold mb-1">Conflicts (row not applied)</h4>
                <ul className="list-disc list-inside space-y-0.5">
                  {lastImportResult.conflicts.slice(0, 10).map((c, i) => (
                    <li key={i}>Row {c.row}: {c.reason}</li>
                  ))}
                  {lastImportResult.conflicts.length > 10 && (
                    <li>… and {lastImportResult.conflicts.length - 10} more</li>
                  )}
                </ul>
              </section>
            )}
            {/* Skipped rows */}
            {lastImportResult.skippedRows.length > 0 && (
              <section className="rounded bg-amber-50 border border-amber-200 p-3 text-amber-900">
                <h4 className="font-semibold mb-1">Skipped rows</h4>
                <ul className="list-disc list-inside space-y-0.5">
                  {lastImportResult.skippedRows.slice(0, 10).map((s, i) => (
                    <li key={i}>Row {s.row}: {s.reason}</li>
                  ))}
                  {lastImportResult.skippedRows.length > 10 && (
                    <li>… and {lastImportResult.skippedRows.length - 10} more</li>
                  )}
                </ul>
              </section>
            )}
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
            players={filteredRosterPlayers}
            canEdit={canEdit}
            onEditPlayer={canEdit ? (p) => setEditingPlayer(p as Player) : undefined}
            onSendInvite={canEdit ? (p) => void handleSendInvite(p as Player) : undefined}
            onDeletePlayer={canEdit ? (p) => void handleDeletePlayer(p as Player) : undefined}
            onImageUploadSuccess={handlePlayerImageUploaded}
            getProfileHref={(p) => {
              const params = new URLSearchParams()
              params.set("teamId", teamId)
              if (rosterViewMode) params.set("view", rosterViewMode)
              if (rosterSearchQuery.trim()) params.set("q", rosterSearchQuery.trim())
              if (rosterPositionFilter) params.set("position", rosterPositionFilter)
              const q = params.toString()
              return `/dashboard/roster/${p.id}${q ? `?${q}` : ""}`
            }}
          />
        ) : (
          <RosterListView
            players={filteredRosterPlayers}
            canEdit={canEdit}
            onEditPlayer={canEdit ? (p) => setEditingPlayer(p as Player) : undefined}
            onSendInvite={canEdit ? (p) => void handleSendInvite(p as Player) : undefined}
            onDeletePlayer={canEdit ? (p) => void handleDeletePlayer(p as Player) : undefined}
            getProfileHref={(p) => {
              const params = new URLSearchParams()
              params.set("teamId", teamId)
              if (rosterViewMode) params.set("view", rosterViewMode)
              if (rosterSearchQuery.trim()) params.set("q", rosterSearchQuery.trim())
              if (rosterPositionFilter) params.set("position", rosterPositionFilter)
              const q = params.toString()
              return `/dashboard/roster/${p.id}${q ? `?${q}` : ""}`
            }}
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
