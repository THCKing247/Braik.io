"use client"

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LayoutGrid,
  List,
  ClipboardCheck,
  AlertCircle,
  History,
  AlertTriangle,
  X,
  MoreHorizontal,
  Printer,
  Mail,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { RosterDesktopSkeleton } from "@/components/portal/dashboard-route-skeletons"
import { RosterMobileSkeleton } from "@/components/portal/roster-mobile-view"
import { RosterGridView } from "./roster-grid-view"
import { RosterListView } from "./roster-list-view"
import { RosterMobileView, type MobileRosterSort } from "./roster-mobile-view"
import { DepthChartView } from "./depth-chart-view"
import { DepthChartMobileWorkspace } from "./depth-chart-mobile-workspace"
import { ProgramDepthChartView } from "./program-depth-chart-view"
import { PlayerPromoteModal } from "./player-promote-modal"
import { CallUpSuggestionsPanel } from "./callup-suggestions-panel"
import { RosterPrintModal } from "./roster-print-modal"
import { RosterEmailModal } from "./roster-email-modal"
import { AddFollowUpModal } from "./add-follow-up-modal"
import { buildPlayerInviteCodeSignupUrl } from "@/lib/app/public-site-url"
import { PortalUnderlineTabs } from "./portal-underline-tabs"
import { ScrollableListContainer } from "./scrollable-list-container"
import { RosterPaginationControls } from "./roster-pagination-controls"
import { usePlaybookToast } from "./playbook-toast"
import { parseRosterLimitResponse } from "@/lib/roster/roster-limit-ui"
import { trackProductEvent } from "@/lib/utils/analytics-client"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

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
  playerPhone?: string | null
  inviteCode?: string | null
  inviteStatus?: "not_invited" | "invite_created" | "invite_sent" | "email_sent" | "sms_sent" | "claimed" | "invited" | "joined"
  joinLink?: string | null
  claimedAt?: string | null
  healthStatus?: "active" | "injured" | "unavailable"
  weight?: number | null
  height?: string | null
  user: { email: string } | null
  guardianLinks: Array<{
    guardian: { user: { email: string } }
  }>
  secondaryPosition?: string | null
  updatedAt?: string | null
}

function mapApiRowToPlayer(p: Record<string, unknown>): Player {
  return {
    ...p,
    guardianLinks: Array.isArray(p.guardianLinks) ? p.guardianLinks : [],
  } as Player
}

function isCompletePlayerCreateResponse(data: unknown): boolean {
  if (!data || typeof data !== "object") return false
  const o = data as Record<string, unknown>
  return typeof o.id === "string" && o.id.length > 0 && typeof o.firstName === "string" && typeof o.lastName === "string"
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

type TeamReadinessSummary = {
  total: number
  readyCount: number
  incompleteCount: number
  missingPhysicalCount: number
  missingWaiverCount: number
  notAccountLinkedCount: number
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
  accountLinked: boolean
  requiredDocsComplete: boolean
  equipmentAssigned: boolean
  assignedEquipmentCount: number
  eligibilityStatus: string | null
  hasGuardians: boolean
  missingItems: string[]
}

interface RosterManagerEnhancedProps {
  teamId: string
  programId?: string | null
  players: Player[]
  canEdit: boolean
  teamSport: string
  userRole?: string
  initialView?: "card" | "list"
  initialSearch?: string
  initialPosition?: string
  initialTab?: "roster" | "depth-chart" | "readiness" | "program-depth"
  /** From dashboard bootstrap — skips initial GET /api/teams/.../readiness until nonce bumps. */
  prefetchedReadinessDetail?: { summary: TeamReadinessSummary; players?: PlayerReadinessItem[] } | null
  /** True while deferred dashboard bootstrap has not merged roster yet — show skeleton without blocking page mount. */
  rosterBootstrapPending?: boolean
}

/** Roster card/list filter: aligns with list Status column semantics. */
function rosterPlayerCategory(p: Player): "active" | "injured" | "inactive" | "unavailable" {
  if (p.healthStatus === "injured") return "injured"
  if (p.healthStatus === "unavailable") return "unavailable"
  if (p.status !== "active") return "inactive"
  return "active"
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

/** Coalesce concurrent readiness bundle fetches. */
const readinessBundleInFlight = new Map<string, Promise<{ summary: TeamReadinessSummary; flags: PlayerReadinessItem[] } | null>>()

function fetchReadinessBundleOnce(teamId: string, bustNonce: number) {
  const key = `${teamId}:${bustNonce}`
  const existing = readinessBundleInFlight.get(key)
  if (existing) return existing
  const p = (async () => {
    const [sumRes, flagsRes] = await Promise.all([
      fetch(`/api/teams/${encodeURIComponent(teamId)}/readiness?summaryOnly=1`),
      fetch(`/api/teams/${encodeURIComponent(teamId)}/readiness?playerFlagsOnly=1`),
    ])
    if (!sumRes.ok || !flagsRes.ok) return null
    const sumData = (await sumRes.json()) as { summary?: TeamReadinessSummary }
    const flagsData = (await flagsRes.json()) as { summary?: TeamReadinessSummary; players?: PlayerReadinessItem[] }
    if (!sumData?.summary || typeof sumData.summary.total !== "number") return null
    return { summary: sumData.summary, flags: flagsData.players ?? [] }
  })().finally(() => readinessBundleInFlight.delete(key))
  readinessBundleInFlight.set(key, p)
  return p
}

const READINESS_PAGE_SIZE = 10

type ReadinessPaginatedResponse = {
  summary: TeamReadinessSummary
  players: PlayerReadinessItem[]
  total: number
  page: number
  pageSize: number
  section: "attention" | "checklist"
}

/** Full readiness (export / one-shot) — not coalesced with paginated table fetches. */
async function fetchReadinessFullExport(teamId: string): Promise<PlayerReadinessItem[] | null> {
  const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/readiness`)
  if (!res.ok) return null
  const data = (await res.json()) as { players?: PlayerReadinessItem[] }
  return Array.isArray(data.players) ? data.players : []
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
    <Card className="w-full max-w-md bg-card border border-border" onClick={(e) => e.stopPropagation()}>
      <CardHeader>
        <CardTitle className="text-foreground">Edit Player</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label className="text-foreground">First Name *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label className="text-foreground">Last Name *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Grade</Label>
            <Input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Jersey Number</Label>
            <Input type="number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-foreground">Position</Label>
            <Input value={positionGroup} onChange={(e) => setPositionGroup(e.target.value)} placeholder="e.g. QB, RB" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Weight (lbs)</Label>
            <Input type="number" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 185" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Height</Label>
            <Input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 5'10&quot; or 6-2" />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-foreground">Email (optional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-foreground">Notes</Label>
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
    <Card className="w-full max-w-2xl bg-card border border-border" onClick={(e) => e.stopPropagation()}>
      <CardHeader>
        <CardTitle className="text-foreground">Add Player</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label className="text-foreground">First Name *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label className="text-foreground">Last Name *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Grade</Label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="flex h-11 w-full rounded-lg border-2 bg-white px-4 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2A5B] focus-visible:ring-offset-2"
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
            <Label className="text-foreground">Jersey Number</Label>
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
            <Label className="text-foreground">Position</Label>
            <select
              value={positionGroup}
              onChange={(e) => setPositionGroup(e.target.value)}
              className="flex h-11 w-full rounded-lg border-2 bg-white px-4 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2A5B] focus-visible:ring-offset-2"
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
            <Label className="text-foreground">Weight (lbs)</Label>
            <Input type="number" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 185" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Height</Label>
            <Input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 5'10&quot; or 6-2" />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-foreground">Email (optional - for invite)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-foreground">Notes</Label>
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
  playerId,
  hasEmail,
  hasPhone,
  inviteCode,
  joinLink,
  onClose,
  onSendEmail,
  onSendSms,
  onCopyLink,
  showToast,
}: {
  playerName: string
  playerId: string
  hasEmail: boolean
  hasPhone: boolean
  inviteCode: string
  joinLink?: string | null
  onClose: () => void
  onSendEmail: () => Promise<void>
  onSendSms: () => Promise<void>
  onCopyLink?: () => void
  showToast: (message: string, variant: "success" | "error") => void
}) {
  const [copied, setCopied] = useState(false)
  const [copiedWhich, setCopiedWhich] = useState<"code" | "link" | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingSms, setSendingSms] = useState(false)
  const fallbackPlayerSignupUrl = inviteCode ? buildPlayerInviteCodeSignupUrl(inviteCode) : ""

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true)
      setCopiedWhich("code")
      setTimeout(() => { setCopied(false); setCopiedWhich(null) }, 2000)
      showToast("Invite code copied", "success")
    })
  }

  const handleCopyLink = () => {
    const text =
      joinLink ||
      (fallbackPlayerSignupUrl ? `${fallbackPlayerSignupUrl}\n\nPlayer invite code: ${inviteCode}` : inviteCode)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setCopiedWhich("link")
      setTimeout(() => { setCopied(false); setCopiedWhich(null) }, 2000)
      showToast("Join link copied", "success")
      onCopyLink?.()
    })
  }

  const handleSendEmail = async () => {
    setSendingEmail(true)
    try {
      await onSendEmail()
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendSms = async () => {
    setSendingSms(true)
    try {
      await onSendSms()
    } finally {
      setSendingSms(false)
    }
  }

  return (
    <Card className="w-full max-w-md bg-card border border-border" onClick={(e) => e.stopPropagation()}>
      <CardHeader>
        <CardTitle className="text-foreground">Invite {playerName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Send an invite by email or text, or copy the join link or code for the player to use.
        </p>
        {hasEmail && (
          <Button variant="outline" size="sm" onClick={handleSendEmail} disabled={sendingEmail} className="w-full justify-start">
            {sendingEmail ? "Sending…" : "Send email invite"}
          </Button>
        )}
        {hasPhone && (
          <Button variant="outline" size="sm" onClick={handleSendSms} disabled={sendingSms} className="w-full justify-start">
            {sendingSms ? "Sending…" : "Send text invite"}
          </Button>
        )}
        {!hasEmail && !hasPhone && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Add email or phone to this player to send an invite by email or text.
          </p>
        )}
        <div className="space-y-2">
          <Label className="text-foreground text-xs">Copy join link</Label>
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="w-full">
            {copied && copiedWhich === "link" ? "Copied!" : "Copy join link"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={inviteCode} className="font-mono" />
          <Button variant="outline" size="sm" onClick={handleCopyCode}>
            {copied && copiedWhich === "code" ? "Copied!" : "Copy invite code"}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function RosterManagerEnhanced({ 
  teamId, 
  programId = null,
  players: initialPlayers, 
  canEdit,
  teamSport,
  userRole,
  initialView = "card",
  initialSearch = "",
  initialPosition = "",
  initialTab = "roster",
  prefetchedReadinessDetail = null,
  rosterBootstrapPending = false,
}: RosterManagerEnhancedProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { showToast } = usePlaybookToast()
  const [players, setPlayers] = useState(initialPlayers)
  const [activeTab, setActiveTab] = useState<"roster" | "depth-chart" | "readiness" | "program-depth">(initialTab)
  const [readinessSummary, setReadinessSummary] = useState<TeamReadinessSummary | null>(
    () => prefetchedReadinessDetail?.summary ?? null
  )
  const [readinessFilterPlayers, setReadinessFilterPlayers] = useState<PlayerReadinessItem[] | null>(() =>
    prefetchedReadinessDetail?.players?.length ? prefetchedReadinessDetail.players : null
  )
  const [readinessBundleLoading, setReadinessBundleLoading] = useState(true)
  /** Paginated "Needs attention" table (independent from checklist). */
  const [attentionPage, setAttentionPage] = useState(1)
  const [attentionQ, setAttentionQ] = useState("")
  const [attentionRows, setAttentionRows] = useState<PlayerReadinessItem[]>([])
  const [attentionTotal, setAttentionTotal] = useState(0)
  const [attentionLoading, setAttentionLoading] = useState(false)
  /** Paginated "Roster checklist" table. */
  const [checklistPage, setChecklistPage] = useState(1)
  const [checklistQ, setChecklistQ] = useState("")
  const [checklistRows, setChecklistRows] = useState<PlayerReadinessItem[]>([])
  const [checklistTotal, setChecklistTotal] = useState(0)
  const [checklistLoading, setChecklistLoading] = useState(false)
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
  const [followUpModalTarget, setFollowUpModalTarget] = useState<{
    playerId: string
    firstName: string
    lastName: string
  } | null>(null)
  const [followUpsRefetchNonce, setFollowUpsRefetchNonce] = useState(0)
  /** Sub-tabs inside Readiness (layout only). */
  const [readinessSubTab, setReadinessSubTab] = useState<"attention" | "checklist" | "activity">("attention")
  /** Bumps after roster mutations so readiness refetches without depending on players.length (avoids N slow refetches). */
  const [readinessRefetchNonce, setReadinessRefetchNonce] = useState(0)
  const [depthChart, setDepthChart] = useState<DepthChartEntry[]>([])
  const [depthChartSnapshot, setDepthChartSnapshot] = useState<DepthChartEntry[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDepthChartModal, setShowDepthChartModal] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [isSavingDepthChart, setIsSavingDepthChart] = useState(false)
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
  const [inviteModal, setInviteModal] = useState<{ player: Player; inviteCode: string; joinLink?: string | null } | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showRosterToolbarMore, setShowRosterToolbarMore] = useState(false)
  /** Suggested Call-Ups only when program has JV and/or Freshman teams to pull from */
  const [programHasJvOrFreshmanForCallups, setProgramHasJvOrFreshmanForCallups] = useState(false)
  /** One DepthChartView at a time — layout switches at lg without double-mount on same breakpoint */
  const [depthChartIsDesktop, setDepthChartIsDesktop] = useState(false)
  const [promotePlayer, setPromotePlayer] = useState<{ player: Player; currentTeamId: string } | null>(null)
  const [rosterViewMode, setRosterViewMode] = useState<"card" | "list">(initialView)
  const [rosterSearchQuery, setRosterSearchQuery] = useState(initialSearch)
  const [rosterPositionFilter, setRosterPositionFilter] = useState<string>(initialPosition)
  const [rosterGradeFilter, setRosterGradeFilter] = useState("")
  /** Desktop card/list parity: filter by active / injured / inactive / unavailable */
  const [rosterPlayerStatusFilter, setRosterPlayerStatusFilter] = useState("")
  const [mobileRosterSort, setMobileRosterSort] = useState<MobileRosterSort>("name_az")
  /** Import CSV as modal on lg+ only; base/md keep inline card */
  const [isLgViewport, setIsLgViewport] = useState(false)

  useEffect(() => {
    setRosterViewMode(initialView)
    setRosterSearchQuery(initialSearch)
    setRosterPositionFilter(initialPosition)
  }, [initialView, initialSearch, initialPosition])

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const apply = () => setIsLgViewport(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  const prevRosterBootstrapPending = useRef(rosterBootstrapPending)
  useEffect(() => {
    if (prevRosterBootstrapPending.current && !rosterBootstrapPending) {
      setPlayers(initialPlayers)
    }
    prevRosterBootstrapPending.current = rosterBootstrapPending
  }, [initialPlayers, rosterBootstrapPending])

  /** Full-page bootstrap had no roster rows yet; show grid skeletons only (not a second shell). */
  const showRosterBootstrapSkeleton = rosterBootstrapPending && initialPlayers.length === 0

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
  }, [rosterViewMode, rosterPositionFilter, rosterSearchQuery, syncRosterParamsToUrl])

  useEffect(() => {
    if (!canEdit || !teamId) return
    if (readinessRefetchNonce === 0 && prefetchedReadinessDetail?.summary) {
      setReadinessSummary(prefetchedReadinessDetail.summary)
      if (prefetchedReadinessDetail.players && prefetchedReadinessDetail.players.length > 0) {
        setReadinessFilterPlayers(prefetchedReadinessDetail.players)
      }
    }
    let cancelled = false
    setReadinessBundleLoading(true)
    fetchReadinessBundleOnce(teamId, readinessRefetchNonce)
      .then((data) => {
        if (cancelled) return
        if (data) {
          setReadinessSummary(data.summary)
          setReadinessFilterPlayers(data.flags)
        } else {
          setReadinessSummary(null)
          setReadinessFilterPlayers(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadinessSummary(null)
          setReadinessFilterPlayers(null)
        }
      })
      .finally(() => {
        if (!cancelled) setReadinessBundleLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canEdit, teamId, readinessRefetchNonce, prefetchedReadinessDetail])

  useEffect(() => {
    if (readinessRefetchNonce > 0) {
      setAttentionPage(1)
      setChecklistPage(1)
    }
  }, [readinessRefetchNonce])

  useEffect(() => {
    if (!canEdit || !teamId || activeTab !== "readiness") return
    let cancelled = false
    setAttentionLoading(true)
    const q = new URLSearchParams({
      section: "attention",
      page: String(attentionPage),
      limit: String(READINESS_PAGE_SIZE),
    })
    if (attentionQ.trim()) q.set("q", attentionQ.trim())
    fetch(`/api/teams/${encodeURIComponent(teamId)}/readiness?${q.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReadinessPaginatedResponse | null) => {
        if (cancelled || !data?.players) return
        setAttentionRows(data.players)
        setAttentionTotal(typeof data.total === "number" ? data.total : data.players.length)
      })
      .catch(() => {
        if (!cancelled) {
          setAttentionRows([])
          setAttentionTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setAttentionLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canEdit, teamId, activeTab, attentionPage, attentionQ, readinessRefetchNonce])

  useEffect(() => {
    if (!canEdit || !teamId || activeTab !== "readiness") return
    let cancelled = false
    setChecklistLoading(true)
    const q = new URLSearchParams({
      section: "checklist",
      page: String(checklistPage),
      limit: String(READINESS_PAGE_SIZE),
    })
    if (checklistQ.trim()) q.set("q", checklistQ.trim())
    fetch(`/api/teams/${encodeURIComponent(teamId)}/readiness?${q.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReadinessPaginatedResponse | null) => {
        if (cancelled || !data?.players) return
        setChecklistRows(data.players)
        setChecklistTotal(typeof data.total === "number" ? data.total : data.players.length)
      })
      .catch(() => {
        if (!cancelled) {
          setChecklistRows([])
          setChecklistTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setChecklistLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canEdit, teamId, activeTab, checklistPage, checklistQ, readinessRefetchNonce])

  useEffect(() => {
    if (!canEdit || !teamId || activeTab !== "readiness") return
    setTeamActivityLoading(true)
    let cancelled = false
    Promise.all([
      fetch(`/api/teams/${teamId}/activity?limit=15`).then((res) => (res.ok ? res.json() : [])),
      fetch(`/api/teams/${teamId}/follow-ups?status=open`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([activityData, followData]) => {
        if (cancelled) return
        setTeamActivity(
          Array.isArray(activityData)
            ? (activityData as Array<{
                id: string
                playerId: string
                playerName: string
                actionType: string
                createdAt: string
                actor: { name: string | null; email: string } | null
              }>)
            : []
        )
        setTeamOpenFollowUps(Array.isArray(followData) ? (followData as Array<{ id: string; playerId: string; category: string }>) : [])
      })
      .catch(() => {
        if (!cancelled) {
          setTeamActivity([])
          setTeamOpenFollowUps([])
        }
      })
      .finally(() => {
        if (!cancelled) setTeamActivityLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canEdit, teamId, activeTab, followUpsRefetchNonce])

  const isFootball = teamSport?.toLowerCase() === "football"

  /** Deep link `?tab=depth-chart` should open the full-view depth chart (same as clicking the tab). */
  useEffect(() => {
    if (initialTab === "depth-chart" && isFootball) {
      setActiveTab("depth-chart")
      setShowDepthChartModal(true)
    }
  }, [initialTab, isFootball])

  useEffect(() => {
    if (!programId) {
      setProgramHasJvOrFreshmanForCallups(false)
      return
    }
    let cancelled = false
    fetch(`/api/programs/${encodeURIComponent(programId)}/teams`)
      .then((r) => (r.ok ? r.json() : { teams: [] }))
      .then((data: { teams?: Array<{ teamLevel?: string | null }> }) => {
        if (cancelled) return
        const teams = data.teams ?? []
        setProgramHasJvOrFreshmanForCallups(
          teams.some((t) => {
            const lv = (t.teamLevel ?? "").toLowerCase()
            return lv === "jv" || lv === "freshman"
          })
        )
      })
      .catch(() => {
        if (!cancelled) setProgramHasJvOrFreshmanForCallups(false)
      })
    return () => {
      cancelled = true
    }
  }, [programId])

  useLayoutEffect(() => {
    if (!showDepthChartModal || !isFootball) return
    const mq = window.matchMedia("(min-width: 1024px)")
    const apply = () => setDepthChartIsDesktop(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [showDepthChartModal, isFootball])

  const readinessFilteredPlayerIds = useMemo(() => {
    if (!readinessFilterPlayers || readinessFilter === "all") return null
    const list = readinessFilterPlayers
    if (readinessFilter === "ready") return new Set(list.filter((p) => p.ready).map((p) => p.playerId))
    if (readinessFilter === "incomplete") return new Set(list.filter((p) => !p.ready).map((p) => p.playerId))
    if (readinessFilter === "missing_physical") return new Set(list.filter((p) => !p.physicalOnFile).map((p) => p.playerId))
    if (readinessFilter === "missing_waiver") return new Set(list.filter((p) => !p.waiverOnFile).map((p) => p.playerId))
    if (readinessFilter === "not_account_linked")
      return new Set(list.filter((p) => !p.accountLinked).map((p) => p.playerId))
    if (readinessFilter === "incomplete_profile") return new Set(list.filter((p) => !p.profileComplete).map((p) => p.playerId))
    if (readinessFilter === "no_equipment") return new Set(list.filter((p) => !p.equipmentAssigned).map((p) => p.playerId))
    if (readinessFilter === "no_guardians") return new Set(list.filter((p) => !p.hasGuardians).map((p) => p.playerId))
    if (readinessFilter === "eligibility_missing") return new Set(list.filter((p) => !p.eligibilityStatus?.trim()).map((p) => p.playerId))
    return null
  }, [readinessFilterPlayers, readinessFilter])

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
    if (rosterGradeFilter) {
      const g = parseInt(rosterGradeFilter, 10)
      if (!Number.isNaN(g)) list = list.filter((p) => p.grade === g)
    }
    if (rosterPlayerStatusFilter) {
      list = list.filter((p) => {
        const c = rosterPlayerCategory(p)
        return c === rosterPlayerStatusFilter
      })
    }
    return list
  }, [players, rosterSearchQuery, rosterPositionFilter, rosterGradeFilter, rosterPlayerStatusFilter, readinessFilteredPlayerIds])

  const rosterPaginationFilterKey = useMemo(
    () =>
      [
        rosterSearchQuery,
        rosterPositionFilter,
        rosterGradeFilter,
        rosterPlayerStatusFilter,
        readinessFilter,
      ].join("|"),
    [
      rosterSearchQuery,
      rosterPositionFilter,
      rosterGradeFilter,
      rosterPlayerStatusFilter,
      readinessFilter,
    ]
  )

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
    if (isSavingDepthChart) return
    if (hasUnsavedChanges) {
      setShowSavePrompt(true)
    } else {
      setShowDepthChartModal(false)
      setActiveTab("roster")
    }
  }

  const handleSaveAndClose = async () => {
    const ok = await handleSaveDepthChart()
    if (!ok) return
    setShowSavePrompt(false)
    setShowDepthChartModal(false)
    setActiveTab("roster")
  }

  const handleCancelDepthChartSavePrompt = () => {
    setShowSavePrompt(false)
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
        const r = parseRosterLimitResponse(data)
        if (r.isRosterLimit) {
          trackProductEvent(BRAIK_EVENTS.billing.upgrade_prompt_shown, {
            teamId,
            eventCategory: "billing",
            metadata: { source: "add_player", limit: r.limit, current: r.current },
          })
        }
        throw new Error(r.message)
      }
      if (isCompletePlayerCreateResponse(data)) {
        setPlayers((prev) => [...prev, mapApiRowToPlayer(data as Record<string, unknown>)])
      } else {
        const rosterRes = await fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}`)
        if (!rosterRes.ok) {
          throw new Error("Player may have been added, but the roster could not be refreshed. Please reload the page.")
        }
        const rosterData = await rosterRes.json()
        const list = Array.isArray(rosterData) ? rosterData : []
        setPlayers(list.map((p: Record<string, unknown>) => mapApiRowToPlayer(p)))
      }
      setReadinessRefetchNonce((n) => n + 1)
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
        const r = parseRosterLimitResponse(data)
        if (r.isRosterLimit) {
          trackProductEvent(BRAIK_EVENTS.billing.upgrade_prompt_shown, {
            teamId,
            eventCategory: "billing",
            metadata: { source: "csv_import", limit: r.limit, current: r.current },
          })
        }
        throw new Error(r.message)
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
      setReadinessRefetchNonce((n) => n + 1)
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
        const r = parseRosterLimitResponse(data)
        if (r.isRosterLimit) {
          trackProductEvent(BRAIK_EVENTS.billing.upgrade_prompt_shown, {
            teamId,
            eventCategory: "billing",
            metadata: { source: "edit_player_active", limit: r.limit, current: r.current },
          })
        }
        throw new Error(r.message)
      }
      const updated = data as Player
      setPlayers((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, user: editingPlayer.user, guardianLinks: editingPlayer.guardianLinks ?? [] } : p)))
      setReadinessRefetchNonce((n) => n + 1)
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
      setReadinessRefetchNonce((n) => n + 1)
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
      const joinLink = (data as { joinLink?: string }).joinLink
      if (code) {
        setInviteModal({ player, inviteCode: code, joinLink: joinLink ?? null })
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === player.id
              ? { ...p, inviteStatus: "invite_created" as const, joinLink: joinLink ?? p.joinLink }
              : p
          )
        )
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error sending invite")
    } finally {
      setInviteLoading(false)
    }
  }

  const handleResendInvite = async (player: Player) => {
    if (player.user) return
    setInviteLoading(true)
    try {
      const response = await fetch(`/api/roster/${player.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? "Failed to resend invite")
      }
      const joinLink = (data as { joinLink?: string }).joinLink
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === player.id ? { ...p, joinLink: joinLink ?? p.joinLink } : p
        )
      )
      if (inviteModal?.player.id === player.id) {
        setInviteModal((m) => (m ? { ...m, joinLink: joinLink ?? m.joinLink } : null))
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error resending invite")
    } finally {
      setInviteLoading(false)
    }
  }

  const handleSendEmailInvite = async (player: Player) => {
    try {
      const res = await fetch("/api/player-invites/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = (data as { error?: string }).error ?? "Failed to send email"
        showToast(msg, "error")
        return
      }
      showToast("Email sent", "success")
      setPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, inviteStatus: "email_sent" as const } : p))
      )
      if (inviteModal?.player.id === player.id) {
        setInviteModal((m) => (m ? { ...m, player: { ...m.player, inviteStatus: "email_sent" } } : null))
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send email", "error")
    }
  }

  const handleSendSmsInvite = async (player: Player) => {
    try {
      const res = await fetch("/api/player-invites/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = (data as { error?: string }).error ?? "Failed to send text"
        showToast(msg, "error")
        return
      }
      showToast("Text sent", "success")
      setPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, inviteStatus: "sms_sent" as const } : p))
      )
      if (inviteModal?.player.id === player.id) {
        setInviteModal((m) => (m ? { ...m, player: { ...m.player, inviteStatus: "sms_sent" } } : null))
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send text", "error")
    }
  }

  const handleRevokeInvite = async (player: Player) => {
    if (player.user) return
    setInviteLoading(true)
    try {
      const response = await fetch(`/api/roster/${player.id}/invite/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Failed to revoke invite")
      }
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === player.id
            ? { ...p, inviteStatus: "not_invited" as const, joinLink: undefined }
            : p
        )
      )
      if (inviteModal?.player.id === player.id) setInviteModal(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error revoking invite")
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCopyJoinLink = (player: Player) => {
    const link = player.joinLink
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      if (typeof window !== "undefined" && (window as unknown as { toast?: { success?: (m: string) => void } }).toast?.success) {
        ;(window as unknown as { toast: { success: (m: string) => void } }).toast.success("Join link copied.")
      }
    })
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

  // Track changes to depth chart (apply locally, mark as unsaved).
  // Store assignments by playerId only; DepthChartView resolves player from roster at render time.
  const handleDepthChartChange = (updates: Array<{
    unit: string
    position: string
    string: number
    playerId: string | null
    formation?: string | null
    specialTeamType?: string | null
  }>) => {
    const updatedChart = [...depthChart]

    updates.forEach((update) => {
      const indicesToRemove: number[] = []
      updatedChart.forEach((e, idx) => {
        if (
          e.unit === update.unit &&
          e.position === update.position &&
          e.string === update.string &&
          (update.specialTeamType
            ? e.specialTeamType === update.specialTeamType
            : (update.formation ? e.formation === update.formation : !e.formation && !e.specialTeamType))
        ) {
          indicesToRemove.push(idx)
        }
      })
      indicesToRemove.reverse().forEach((idx) => updatedChart.splice(idx, 1))

      if (update.playerId) {
        updatedChart.push({
          id: `temp-${Date.now()}-${Math.random()}`,
          unit: update.unit,
          position: update.position,
          string: update.string,
          playerId: update.playerId,
          formation: update.formation ?? null,
          specialTeamType: update.specialTeamType ?? null,
        })
      }
    })

    setDepthChart(updatedChart)
    setHasUnsavedChanges(true)
  }

  const handleSaveDepthChart = async (): Promise<boolean> => {
    if (!canEdit) return false
    const updates = depthChart.map((e) => ({
      unit: e.unit,
      position: e.position,
      string: e.string,
      playerId: e.playerId,
      formation: e.formation || null,
      specialTeamType: e.specialTeamType || null,
    }))

    setIsSavingDepthChart(true)
    try {
      await handleDepthChartUpdate(updates)

      const reloadResponse = await fetch(`/api/roster/depth-chart?teamId=${teamId}`)
      if (!reloadResponse.ok) {
        showToast("Could not refresh the depth chart after saving. Try again.", "error")
        return false
      }
      const data = await reloadResponse.json()
      const entries = (data.entries || []).map((e: DepthChartEntry) => {
        if (e.playerId && !e.player) {
          const player = players.find((p) => p.id === e.playerId)
          return { ...e, player: player || null }
        }
        return e
      })
      setDepthChart(entries)
      setDepthChartSnapshot(JSON.parse(JSON.stringify(entries)))
      setHasUnsavedChanges(false)
      showToast("Depth chart saved", "success")
      return true
    } catch (error) {
      console.error("Failed to save depth chart:", error)
      showToast(error instanceof Error ? error.message : "Failed to save depth chart", "error")
      return false
    } finally {
      setIsSavingDepthChart(false)
    }
  }

  const rosterProfileHref = (p: Player) => {
    const params = new URLSearchParams()
    params.set("teamId", teamId)
    if (rosterViewMode) params.set("view", rosterViewMode)
    if (rosterSearchQuery.trim()) params.set("q", rosterSearchQuery.trim())
    if (rosterPositionFilter) params.set("position", rosterPositionFilter)
    const q = params.toString()
    return `/dashboard/roster/${p.id}${q ? `?${q}` : ""}`
  }

  const tabBtnClass = (active: boolean) =>
    `flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap px-3 text-sm font-semibold transition-colors sm:px-4 lg:min-h-10 lg:rounded-none lg:border-b-2 lg:px-4 ${
      active
        ? "rounded-t-lg border-b-[3px] border-primary bg-primary/10 text-foreground lg:border-primary lg:bg-transparent"
        : "rounded-t-lg border-b-[3px] border-transparent text-foreground/70 hover:bg-muted/50 hover:text-foreground lg:border-transparent lg:hover:bg-muted/30"
    }`

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-4 pb-6 lg:px-0 lg:pb-0">
      {/* Tab Navigation — scrollable on small screens, 44px tap targets */}
      <div className="mb-4 border-b border-border lg:mb-6">
        <div
          className="-mx-4 flex gap-0 overflow-x-auto overscroll-x-contain px-2 pb-0 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:gap-1 lg:overflow-visible lg:px-0 lg:pt-0 [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Roster sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "roster"}
            onClick={() => setActiveTab("roster")}
            className={tabBtnClass(activeTab === "roster")}
          >
            Roster View
          </button>
          {canEdit && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "readiness"}
              onClick={() => setActiveTab("readiness")}
              className={`${tabBtnClass(activeTab === "readiness")} gap-2`}
            >
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              Readiness
            </button>
          )}
          {isFootball && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "depth-chart"}
              onClick={handleOpenDepthChart}
              className={tabBtnClass(activeTab === "depth-chart")}
            >
              Depth Chart
            </button>
          )}
          {isFootball && programId && canEdit && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "program-depth"}
              onClick={() => setActiveTab("program-depth")}
              className={tabBtnClass(activeTab === "program-depth")}
            >
              Program Depth
            </button>
          )}
        </div>
      </div>

      {activeTab === "roster" && (
        <>
          {/* Phone / tablet: sticky toolbar + touch roster cards */}
          <div className="lg:hidden">
            <div className="sticky top-0 z-20 -mx-4 mb-6 space-y-4 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/90">
              <Input
                type="search"
                placeholder="Search players…"
                value={rosterSearchQuery}
                onChange={(e) => setRosterSearchQuery(e.target.value)}
                className="h-12 w-full min-w-0 rounded-xl text-base"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={rosterPositionFilter}
                  onChange={(e) => setRosterPositionFilter(e.target.value)}
                  className="min-h-[44px] w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                <select
                  value={rosterGradeFilter}
                  onChange={(e) => setRosterGradeFilter(e.target.value)}
                  className="min-h-[44px] w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Filter by grade"
                >
                  <option value="">All grades</option>
                  <option value="9">Freshman (9)</option>
                  <option value="10">Sophomore (10)</option>
                  <option value="11">Junior (11)</option>
                  <option value="12">Senior (12)</option>
                  <option value="1">College Yr 1</option>
                  <option value="2">College Yr 2</option>
                  <option value="3">College Yr 3</option>
                  <option value="4">College Yr 4</option>
                </select>
                {canEdit && readinessFilterPlayers ? (
                  <>
                    <select
                      value={readinessFilter}
                      onChange={(e) => setReadinessFilter(e.target.value)}
                      className="min-h-[44px] w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label="Filter by readiness"
                    >
                      <option value="all">All readiness</option>
                      <option value="ready">Ready</option>
                      <option value="incomplete">Incomplete</option>
                      <option value="missing_physical">Missing physical</option>
                      <option value="missing_waiver">Missing waiver</option>
                      <option value="not_account_linked">Account not linked</option>
                      <option value="incomplete_profile">Incomplete profile</option>
                      <option value="no_equipment">No equipment</option>
                      <option value="no_guardians">No guardians</option>
                      <option value="eligibility_missing">Eligibility N/A</option>
                    </select>
                    <select
                      value={mobileRosterSort}
                      onChange={(e) => setMobileRosterSort(e.target.value as MobileRosterSort)}
                      className="min-h-[44px] w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label="Sort roster"
                    >
                      <option value="name_az">Sort: Name A–Z</option>
                      <option value="jersey">Sort: Jersey</option>
                      <option value="position">Sort: Position</option>
                      <option value="updated">Sort: Recently updated</option>
                    </select>
                  </>
                ) : (
                  <select
                    value={mobileRosterSort}
                    onChange={(e) => setMobileRosterSort(e.target.value as MobileRosterSort)}
                    className="col-span-2 min-h-[44px] w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label="Sort roster"
                  >
                    <option value="name_az">Sort: Name A–Z</option>
                    <option value="jersey">Sort: Jersey</option>
                    <option value="position">Sort: Position</option>
                    <option value="updated">Sort: Recently updated</option>
                  </select>
                )}
              </div>
              {canEdit &&
                !showAddModal &&
                !showImportForm &&
                !showPrintModal &&
                !showEmailModal &&
                !showRosterToolbarMore && (
                  <div className="flex flex-wrap items-stretch gap-3">
                    <Button
                      className="min-h-[44px] min-w-0 flex-1 rounded-xl px-4 sm:flex-initial sm:min-w-[140px]"
                      onClick={() => setShowAddModal(true)}
                    >
                      Add Player
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[44px] min-w-0 flex-1 rounded-xl px-4 sm:flex-initial sm:min-w-[120px]"
                      onClick={() => setShowImportForm(true)}
                    >
                      Import CSV
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[44px] shrink-0 rounded-xl px-4"
                      onClick={() => setShowRosterToolbarMore(true)}
                      aria-label="More roster actions"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </div>
                )}
            </div>
            {!showPrintModal && !showEmailModal && (
              showRosterBootstrapSkeleton ? (
                <RosterMobileSkeleton count={6} />
              ) : (
                <RosterMobileView
                  players={filteredRosterPlayers}
                  filterKey={rosterPaginationFilterKey}
                  sort={mobileRosterSort}
                  teamId={teamId}
                  canEdit={canEdit}
                  onEditPlayer={canEdit ? (p) => setEditingPlayer(p as Player) : undefined}
                  onSendInvite={canEdit ? (p) => void handleSendInvite(p as Player) : undefined}
                  onCopyJoinLink={canEdit ? (p) => handleCopyJoinLink(p as Player) : undefined}
                  onResendInvite={canEdit ? (p) => void handleResendInvite(p as Player) : undefined}
                  onRevokeInvite={canEdit ? (p) => void handleRevokeInvite(p as Player) : undefined}
                  onDeletePlayer={canEdit ? (p) => void handleDeletePlayer(p as Player) : undefined}
                  onPromotePlayer={
                    isFootball && programId && userRole === "HEAD_COACH" && canEdit
                      ? (p) => setPromotePlayer({ player: p as Player, currentTeamId: teamId })
                      : undefined
                  }
                  getProfileHref={(p) => rosterProfileHref(p as Player)}
                  onAddPlayer={canEdit ? () => setShowAddModal(true) : undefined}
                  onImport={canEdit ? () => setShowImportForm(true) : undefined}
                />
              )
            )}
          </div>

          {/* Desktop: table / card grid */}
          <div className="mb-6 hidden items-center justify-between gap-4 lg:flex lg:flex-wrap">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="search"
                placeholder="Search by name..."
                value={rosterSearchQuery}
                onChange={(e) => setRosterSearchQuery(e.target.value)}
                className="h-9 max-w-[220px] text-sm"
              />
              <select
                value={rosterPositionFilter}
                onChange={(e) => setRosterPositionFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
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
              {canEdit && readinessFilterPlayers && (
                <select
                  value={readinessFilter}
                  onChange={(e) => setReadinessFilter(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  aria-label="Filter by readiness"
                >
                  <option value="all">All readiness</option>
                  <option value="ready">Ready</option>
                  <option value="incomplete">Incomplete</option>
                  <option value="missing_physical">Missing physical</option>
                  <option value="missing_waiver">Missing waiver</option>
                  <option value="not_account_linked">Account not linked</option>
                  <option value="incomplete_profile">Incomplete profile</option>
                  <option value="no_equipment">No equipment</option>
                  <option value="no_guardians">No guardians linked</option>
                  <option value="eligibility_missing">Eligibility not set</option>
                </select>
              )}
              <select
                value={rosterGradeFilter}
                onChange={(e) => setRosterGradeFilter(e.target.value)}
                className="hidden h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary lg:block"
                aria-label="Filter by grade"
              >
                <option value="">All grades</option>
                <option value="9">Freshman (9)</option>
                <option value="10">Sophomore (10)</option>
                <option value="11">Junior (11)</option>
                <option value="12">Senior (12)</option>
                <option value="1">College Yr 1</option>
                <option value="2">College Yr 2</option>
                <option value="3">College Yr 3</option>
                <option value="4">College Yr 4</option>
              </select>
              <select
                value={rosterPlayerStatusFilter}
                onChange={(e) => setRosterPlayerStatusFilter(e.target.value)}
                className="hidden h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary lg:block"
                aria-label="Filter by player status"
              >
                <option value="">All player statuses</option>
                <option value="active">Active</option>
                <option value="injured">Injured</option>
                <option value="unavailable">Unavailable</option>
                <option value="inactive">Inactive</option>
              </select>
              <span className="text-sm font-medium text-muted-foreground">View:</span>
              <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
                <Button
                  type="button"
                  variant={rosterViewMode === "card" ? "secondary" : "icon"}
                  onClick={() => setRosterViewMode("card")}
                  aria-pressed={rosterViewMode === "card"}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium h-auto min-h-0"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Cards
                </Button>
                <Button
                  type="button"
                  variant={rosterViewMode === "list" ? "secondary" : "icon"}
                  onClick={() => setRosterViewMode("list")}
                  aria-pressed={rosterViewMode === "list"}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium h-auto min-h-0"
                >
                  <List className="h-4 w-4" />
                  List
                </Button>
              </div>
            </div>
            {canEdit && !showAddModal && !showImportForm && !showPrintModal && !showEmailModal && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowAddModal(true)}>Add Player</Button>
                <Button variant="outline" onClick={() => setShowImportForm(true)}>
                  Import CSV
                </Button>
                <Button variant="outline" onClick={() => setShowPrintModal(true)}>
                  Print Roster
                </Button>
                <Button variant="outline" onClick={() => setShowEmailModal(true)}>
                  Email Roster
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Team Readiness Dashboard */}
      {activeTab === "readiness" && (
        <div className="space-y-6">
          {readinessBundleLoading && !readinessSummary ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !readinessSummary ? (
            <Card className="border border-border bg-card">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Could not load readiness.
              </CardContent>
            </Card>
          ) : readinessSummary.total === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="py-12 text-center">
                <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-sm font-medium text-muted-foreground">No players on roster</p>
                <p className="mt-1 text-sm text-muted-foreground">Add players to see readiness summary.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <Card className="border border-border bg-card">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{readinessSummary.total}</p>
                  </CardContent>
                </Card>
                <Card className="border border-emerald-200 bg-emerald-50/50">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Ready</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-800">{readinessSummary.readyCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-amber-200 bg-amber-50/50">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Incomplete</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-800">{readinessSummary.incompleteCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-card">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Missing physical</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{readinessSummary.missingPhysicalCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-card">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Missing waiver</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{readinessSummary.missingWaiverCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-card">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account not linked</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">
                      {readinessSummary.notAccountLinkedCount ?? 0}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-card">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Incomplete profile</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{readinessSummary.incompleteProfileCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-card">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">No equipment</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{readinessSummary.noEquipmentCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-card">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">No guardians</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{readinessSummary.noGuardiansCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-card">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Eligibility not set</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{readinessSummary.eligibilityMissingCount}</p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-card">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open follow-ups</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{teamOpenFollowUps.length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Readiness sections — same tab pattern as Player Profile (`PortalUnderlineTabs`) */}
              <PortalUnderlineTabs
                tabs={[
                  {
                    id: "attention",
                    label: "Needs Attention",
                    tabId: "readiness-tab-attention",
                    panelId: "readiness-panel-attention",
                  },
                  {
                    id: "checklist",
                    label: (
                      <span className="inline-flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 shrink-0" />
                        Roster Checklist
                      </span>
                    ),
                    tabId: "readiness-tab-checklist",
                    panelId: "readiness-panel-checklist",
                  },
                  {
                    id: "activity",
                    label: "Recent Team Activity",
                    tabId: "readiness-tab-activity",
                    panelId: "readiness-panel-activity",
                  },
                ]}
                value={readinessSubTab}
                onValueChange={(id) =>
                  setReadinessSubTab(id as "attention" | "checklist" | "activity")
                }
                ariaLabel="Readiness sections"
              />

              {readinessSubTab === "attention" && (
                <Card
                  id="readiness-panel-attention"
                  role="tabpanel"
                  aria-labelledby="readiness-tab-attention"
                  className="border border-border bg-card"
                >
                  <CardHeader className="space-y-3">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                        Needs Attention
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">Players with missing items. Click a row to open profile.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Input
                        type="search"
                        placeholder="Search by name…"
                        value={attentionQ}
                        onChange={(e) => {
                          setAttentionQ(e.target.value)
                          setAttentionPage(1)
                        }}
                        className="h-9 max-w-xs text-sm"
                        aria-label="Search needs attention"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {attentionLoading ? (
                      <div className="flex justify-center py-10">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : attentionTotal === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">All players are ready.</p>
                    ) : (
                      <ScrollableListContainer
                        naturalHeight
                        contentKey={`${attentionTotal}-${attentionPage}-${attentionQ}`}
                        backToTopAriaLabel="Back to top of needs attention list"
                        showBackToTop={false}
                        footer={
                          <RosterPaginationControls
                            page={attentionPage}
                            totalItems={attentionTotal}
                            pageSize={READINESS_PAGE_SIZE}
                            onPageChange={setAttentionPage}
                          />
                        }
                      >
                        <table className="w-full min-w-[640px] border-collapse text-sm">
                          <thead className="sticky top-0 z-[1] border-b border-[#E5E7EB] bg-[#F8FAFC]">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold align-middle min-w-[11rem] text-[#0F172A]">
                                Player
                              </th>
                              <th className="px-4 py-3 text-sm font-semibold align-middle w-28 whitespace-nowrap text-[#0F172A]">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-sm font-semibold align-middle min-w-[12rem] text-[#0F172A]">
                                Missing
                              </th>
                              {canEdit && (
                                <th className="px-4 py-3 text-sm font-semibold align-middle w-36 whitespace-nowrap text-[#0F172A]">
                                  Follow-ups
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {attentionRows.map((p) => {
                              const params = new URLSearchParams()
                              params.set("teamId", teamId)
                              const profileHref = `/dashboard/roster/${p.playerId}?${params.toString()}`
                              const openCount = teamOpenFollowUps.filter((f) => f.playerId === p.playerId).length
                              return (
                                <tr key={p.playerId} className="border-b border-border/60 hover:bg-muted/30">
                                  <td className="px-4 py-3.5 align-top">
                                    <Link
                                      href={profileHref}
                                      className="font-medium text-primary hover:underline"
                                    >
                                      {p.firstName} {p.lastName}
                                    </Link>
                                    {!p.hasGuardians && (
                                      <span
                                        className="ml-2 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                                        title="No guardians linked"
                                      >
                                        No guardians
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                                    {p.ready ? (
                                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                                        Ready
                                      </span>
                                    ) : (
                                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                                        Incomplete
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5 align-top text-muted-foreground leading-relaxed">
                                    {p.missingItems.join(", ") || "—"}
                                  </td>
                                  {canEdit && (
                                    <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                                      {openCount > 0 ? (
                                        <span className="text-amber-700 text-xs font-medium">{openCount} open</span>
                                      ) : null}
                                      <button
                                        type="button"
                                        className="ml-2 text-xs text-primary hover:underline"
                                        onClick={() =>
                                          setFollowUpModalTarget({
                                            playerId: p.playerId,
                                            firstName: p.firstName,
                                            lastName: p.lastName,
                                          })
                                        }
                                      >
                                        Add follow-up
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </ScrollableListContainer>
                    )}
                  </CardContent>
                </Card>
              )}

              {readinessSubTab === "checklist" && (
                <Card
                  id="readiness-panel-checklist"
                  role="tabpanel"
                  aria-labelledby="readiness-tab-checklist"
                  className="border border-border bg-card"
                >
                  <CardHeader className="space-y-3 lg:space-y-3">
                    <div className="space-y-1 lg:space-y-2">
                      <CardTitle className="text-base font-semibold text-foreground">Roster Checklist</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Physical, waiver, required forms, and whether the player has linked their app account.
                      </p>
                    </div>
                    <Input
                      type="search"
                      placeholder="Search by name…"
                      value={checklistQ}
                      onChange={(e) => {
                        setChecklistQ(e.target.value)
                        setChecklistPage(1)
                      }}
                      className="h-9 max-w-xs text-sm"
                      aria-label="Search roster checklist"
                    />
                  </CardHeader>
                  <CardContent className="space-y-4 lg:space-y-5">
                    <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                      <p className="text-sm text-muted-foreground lg:max-w-xl">
                        Export the full checklist or incomplete players only. Downloads use your current roster data.
                      </p>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="lg:h-9"
                          onClick={() => {
                            void (async () => {
                              const full = await fetchReadinessFullExport(teamId)
                              if (!full) {
                                showToast("Could not load readiness data for export.", "error")
                                return
                              }
                              const headers = [
                                "First Name",
                                "Last Name",
                                "Ready",
                                "Profile Complete",
                                "Physical",
                                "Waiver",
                                "Forms complete",
                                "Account linked",
                                "Equipment",
                                "Guardians",
                                "Eligibility",
                                "Open Follow-ups",
                                "Missing Items",
                              ]
                              const rows = full.map((p) => [
                                p.firstName,
                                p.lastName,
                                p.ready ? "Yes" : "No",
                                p.profileComplete ? "Yes" : "No",
                                p.physicalOnFile ? "Yes" : "No",
                                p.waiverOnFile ? "Yes" : "No",
                                p.requiredDocsComplete ? "Yes" : "No",
                                p.accountLinked ? "Yes" : "No",
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
                            })()
                          }}
                        >
                          Export readiness (CSV)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="lg:h-9"
                          onClick={() => {
                            void (async () => {
                              const full = await fetchReadinessFullExport(teamId)
                              if (!full) {
                                showToast("Could not load readiness data for export.", "error")
                                return
                              }
                              const incomplete = full.filter((p) => !p.ready)
                              const headers = [
                                "First Name",
                                "Last Name",
                                "Profile Complete",
                                "Physical",
                                "Waiver",
                                "Forms complete",
                                "Account linked",
                                "Equipment",
                                "Guardians",
                                "Eligibility",
                                "Open Follow-ups",
                                "Missing Items",
                              ]
                              const rows = incomplete.map((p) => [
                                p.firstName,
                                p.lastName,
                                p.profileComplete ? "Yes" : "No",
                                p.physicalOnFile ? "Yes" : "No",
                                p.waiverOnFile ? "Yes" : "No",
                                p.requiredDocsComplete ? "Yes" : "No",
                                p.accountLinked ? "Yes" : "No",
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
                            })()
                          }}
                        >
                          Export incomplete only (CSV)
                        </Button>
                      </div>
                    </div>
                    {checklistLoading ? (
                      <div className="flex justify-center py-10">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : checklistTotal === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">No players on roster.</p>
                    ) : (
                      <ScrollableListContainer
                        naturalHeight
                        contentKey={`${checklistTotal}-${checklistPage}-${checklistQ}`}
                        backToTopAriaLabel="Back to top of roster checklist"
                        showBackToTop={false}
                        footer={
                          <RosterPaginationControls
                            page={checklistPage}
                            totalItems={checklistTotal}
                            pageSize={READINESS_PAGE_SIZE}
                            onPageChange={setChecklistPage}
                          />
                        }
                      >
                        <table className="w-full min-w-[36rem] border-collapse text-sm">
                          <thead className="sticky top-0 z-[1] border-b border-[#E5E7EB] bg-[#F8FAFC]">
                            <tr>
                              <th className="w-[40%] px-4 py-3 text-left text-sm font-semibold text-[#0F172A]">Player</th>
                              <th className="px-3 py-3 text-center text-sm font-semibold text-[#0F172A]">Physical</th>
                              <th className="px-3 py-3 text-center text-sm font-semibold text-[#0F172A]">Waiver</th>
                              <th className="px-3 py-3 text-center text-sm font-semibold text-[#0F172A]">Forms</th>
                              <th className="px-3 py-3 text-center text-sm font-semibold leading-tight text-[#0F172A]">
                                Acct linked
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {checklistRows.map((p) => {
                              const params = new URLSearchParams()
                              params.set("teamId", teamId)
                              const profileHref = `/dashboard/roster/${p.playerId}?${params.toString()}`
                              const cell = (ok: boolean) => (
                                <span
                                  className={ok ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}
                                >
                                  {ok ? "Yes" : "No"}
                                </span>
                              )
                              return (
                                <tr key={p.playerId} className="border-b border-border/60 hover:bg-muted/30">
                                  <td className="px-4 py-3.5 align-middle">
                                    <Link href={profileHref} className="font-medium text-primary hover:underline break-words">
                                      {p.firstName} {p.lastName}
                                    </Link>
                                  </td>
                                  <td className="px-2 py-3.5 text-center align-middle">{cell(p.physicalOnFile)}</td>
                                  <td className="px-2 py-3.5 text-center align-middle">{cell(p.waiverOnFile)}</td>
                                  <td className="px-2 py-3.5 text-center align-middle">{cell(p.requiredDocsComplete)}</td>
                                  <td className="px-2 py-3.5 text-center align-middle">{cell(Boolean(p.accountLinked))}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </ScrollableListContainer>
                    )}
                  </CardContent>
                </Card>
              )}

              {readinessSubTab === "activity" && (
                <Card
                  id="readiness-panel-activity"
                  role="tabpanel"
                  aria-labelledby="readiness-tab-activity"
                  className="border border-border bg-card"
                >
                  <CardHeader className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <History className="h-5 w-5 shrink-0 text-muted-foreground" />
                      Recent Team Activity
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Latest profile changes across the roster.</p>
                  </CardHeader>
                  <CardContent>
                    {teamActivityLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : teamActivity.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">No recent activity.</p>
                    ) : (
                      <ScrollableListContainer
                        contentKey={teamActivity.length}
                        scrollClassName="p-3"
                        backToTopAriaLabel="Back to top of activity list"
                      >
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
                              <li
                                key={a.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
                              >
                                <div className="min-w-0">
                                  <Link href={profileHref} className="font-medium text-primary hover:underline">
                                    {a.playerName}
                                  </Link>
                                  <span className="ml-2 text-muted-foreground">— {label}</span>
                                  {a.actor?.name && (
                                    <span className="ml-1 text-xs text-muted-foreground">by {a.actor.name}</span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{timeAgo}</span>
                              </li>
                            )
                          })}
                        </ul>
                      </ScrollableListContainer>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Import Form — modal on lg+, inline card below md (unchanged for mobile/tablet) */}
      {showImportForm && isLgViewport && (
        <Dialog open={showImportForm} onOpenChange={(open) => !open && !loading && setShowImportForm(false)}>
          <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Import Players from CSV</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Upload a CSV to add or update players. Same modes as before.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Import mode</Label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as "create_only" | "create_or_update" | "replace_roster")}
                  className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm text-foreground ${
                    importMode === "replace_roster"
                      ? "border-red-300 bg-red-50/50 focus-visible:ring-red-500"
                      : "border-border bg-background focus-visible:ring-primary"
                  }`}
                >
                  <option value="create_only">Create only (add new players; skip or duplicate if already exist)</option>
                  <option value="create_or_update">Create or update (match by email or name + jersey, update existing)</option>
                  <option value="replace_roster">Replace roster (remove all current players, then add from CSV)</option>
                </select>
                <p className="text-xs text-muted-foreground">
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
                <Label className="text-foreground">CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  CSV format: First Name, Last Name, Grade, Jersey Number, Position, Email (optional), Notes (optional), Weight (optional), Height (optional)
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button onClick={handleCsvImport} disabled={loading || !csvFile}>
                {loading ? "Importing..." : "Import CSV"}
              </Button>
              <Button variant="outline" onClick={() => setShowImportForm(false)} disabled={loading}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {showImportForm && !isLgViewport && (
        <Card className="mb-6 bg-card border border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Import Players from CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Import mode</Label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as "create_only" | "create_or_update" | "replace_roster")}
                  className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm text-foreground ${
                    importMode === "replace_roster"
                      ? "border-red-300 bg-red-50/50 focus-visible:ring-red-500"
                      : "border-border bg-background focus-visible:ring-primary"
                  }`}
                >
                  <option value="create_only">Create only (add new players; skip or duplicate if already exist)</option>
                  <option value="create_or_update">Create or update (match by email or name + jersey, update existing)</option>
                  <option value="replace_roster">Replace roster (remove all current players, then add from CSV)</option>
                </select>
                <p className="text-xs text-muted-foreground">
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
                <Label className="text-foreground">CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="text-foreground"
                />
                <p className="text-xs text-muted-foreground">
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
            <DialogDescription className="text-muted-foreground">
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
            <Card className="w-full max-w-md bg-card border border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Confirm add player</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground" style={{ lineHeight: 1.5 }}>
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
              playerId={inviteModal.player.id}
              hasEmail={!!inviteModal.player.email?.trim()}
              hasPhone={!!inviteModal.player.playerPhone?.trim()}
              inviteCode={inviteModal.inviteCode}
              joinLink={inviteModal.joinLink}
              onClose={() => setInviteModal(null)}
              onSendEmail={() => handleSendEmailInvite(inviteModal.player)}
              onSendSms={() => handleSendSmsInvite(inviteModal.player)}
              onCopyLink={inviteModal.player.joinLink ? () => {} : undefined}
              showToast={showToast}
            />
          </div>
        </>
      )}

      {/* Program depth chart (all levels) */}
      {activeTab === "program-depth" && programId && (
        <ProgramDepthChartView programId={programId} />
      )}

      {/* Content Views */}
      {activeTab === "roster" && !showPrintModal && !showEmailModal && (
        <div className="hidden min-w-0 w-full max-w-full overflow-x-hidden lg:block">
          {showRosterBootstrapSkeleton ? (
            <div className="min-w-0 max-w-full [&>div>div:first-child]:hidden">
              <RosterDesktopSkeleton />
            </div>
          ) : rosterViewMode === "card" ? (
            <RosterGridView
              players={filteredRosterPlayers}
              filterKey={rosterPaginationFilterKey}
              canEdit={canEdit}
              onEditPlayer={canEdit ? (p) => setEditingPlayer(p as Player) : undefined}
              onSendInvite={canEdit ? (p) => void handleSendInvite(p as Player) : undefined}
              onCopyJoinLink={canEdit ? (p) => handleCopyJoinLink(p as Player) : undefined}
              onResendInvite={canEdit ? (p) => void handleResendInvite(p as Player) : undefined}
              onRevokeInvite={canEdit ? (p) => void handleRevokeInvite(p as Player) : undefined}
              onDeletePlayer={canEdit ? (p) => void handleDeletePlayer(p as Player) : undefined}
              onPromotePlayer={
                isFootball && programId && userRole === "HEAD_COACH" && canEdit
                  ? (p) => setPromotePlayer({ player: p as Player, currentTeamId: teamId })
                  : undefined
              }
              onImageUploadSuccess={handlePlayerImageUploaded}
              getProfileHref={(p) => rosterProfileHref(p as Player)}
            />
          ) : (
            <RosterListView
              players={filteredRosterPlayers}
              canEdit={canEdit}
              onEditPlayer={canEdit ? (p) => setEditingPlayer(p as Player) : undefined}
              onSendInvite={canEdit ? (p) => void handleSendInvite(p as Player) : undefined}
              onCopyJoinLink={canEdit ? (p) => handleCopyJoinLink(p as Player) : undefined}
              onResendInvite={canEdit ? (p) => void handleResendInvite(p as Player) : undefined}
              onRevokeInvite={canEdit ? (p) => void handleRevokeInvite(p as Player) : undefined}
              onDeletePlayer={canEdit ? (p) => void handleDeletePlayer(p as Player) : undefined}
              onPromotePlayer={
                isFootball && programId && userRole === "HEAD_COACH" && canEdit
                  ? (p) => setPromotePlayer({ player: p as Player, currentTeamId: teamId })
                  : undefined
              }
              getProfileHref={(p) => rosterProfileHref(p as Player)}
            />
          )}
        </div>
      )}

      <AddFollowUpModal
        open={followUpModalTarget !== null}
        onOpenChange={(open) => {
          if (!open) setFollowUpModalTarget(null)
        }}
        playerId={followUpModalTarget?.playerId ?? ""}
        teamId={teamId}
        playerDisplayName={
          followUpModalTarget
            ? `${followUpModalTarget.firstName} ${followUpModalTarget.lastName}`.trim() || "Player"
            : ""
        }
        onSuccess={() => setFollowUpsRefetchNonce((n) => n + 1)}
      />

      {/* Print Modal */}
      {showPrintModal && (
        <RosterPrintModal teamId={teamId} onClose={() => setShowPrintModal(false)} />
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <RosterEmailModal teamId={teamId} onClose={() => setShowEmailModal(false)} />
      )}

      {/* Mobile: Print / Email in "More" sheet */}
      {showRosterToolbarMore && canEdit && (
        <div className="fixed inset-0 z-[55] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setShowRosterToolbarMore(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 z-10 rounded-t-3xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
            role="dialog"
            aria-labelledby="roster-more-actions-title"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
            <h2 id="roster-more-actions-title" className="mb-4 text-lg font-semibold text-foreground">
              More actions
            </h2>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="min-h-[48px] w-full justify-start gap-3 rounded-xl"
                onClick={() => {
                  setShowRosterToolbarMore(false)
                  setShowPrintModal(true)
                }}
              >
                <Printer className="h-5 w-5 shrink-0" />
                Print roster
              </Button>
              <Button
                variant="outline"
                className="min-h-[48px] w-full justify-start gap-3 rounded-xl"
                onClick={() => {
                  setShowRosterToolbarMore(false)
                  setShowEmailModal(true)
                }}
              >
                <Mail className="h-5 w-5 shrink-0" />
                Email roster
              </Button>
              <Button
                variant="secondary"
                className="min-h-[48px] w-full rounded-xl"
                onClick={() => setShowRosterToolbarMore(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Promote / Move player modal */}
      {promotePlayer && programId && isFootball && (
        <PlayerPromoteModal
          open={!!promotePlayer}
          onClose={() => setPromotePlayer(null)}
          programId={programId}
          playerId={promotePlayer.player.id}
          playerName={`${promotePlayer.player.firstName} ${promotePlayer.player.lastName}`}
          currentTeamId={promotePlayer.currentTeamId}
          onSuccess={() => {
            setPromotePlayer(null)
            window.location.reload()
          }}
        />
      )}

      {/* Depth Chart: mobile/tablet UX (bottom sheet) · desktop uses full-screen below */}
      {showDepthChartModal && isFootball && !depthChartIsDesktop && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="depth-chart-sheet-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close depth chart"
            onClick={handleCloseDepthChart}
          />
          <div
            className="absolute bottom-0 left-0 right-0 z-10 flex max-h-[90vh] flex-col rounded-t-3xl bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl">
              <DepthChartMobileWorkspace
                teamId={teamId}
                players={players}
                depthChart={depthChart}
                onUpdate={handleDepthChartChange}
                canEdit={canEdit}
                isHeadCoach={userRole === "HEAD_COACH"}
                programId={programId ?? null}
                showCallUpSuggestions={programHasJvOrFreshmanForCallups}
                onClose={handleCloseDepthChart}
                onSave={handleSaveDepthChart}
                hasUnsavedChanges={hasUnsavedChanges}
                isSaving={isSavingDepthChart}
              />
            </div>
          </div>
        </div>
      )}
      {showDepthChartModal && isFootball && depthChartIsDesktop && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="sticky top-0 z-10 flex min-h-[3.25rem] items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 shadow-sm sm:px-4 sm:py-3">
            <h2 className="min-w-0 flex-1 text-lg font-semibold text-foreground sm:text-xl lg:text-2xl">Depth Chart</h2>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {hasUnsavedChanges ? (
                <span className="max-w-[40vw] truncate text-xs font-medium text-amber-600 sm:max-w-none sm:text-sm">
                  Unsaved changes
                </span>
              ) : null}
              {canEdit && (
                <Button
                  type="button"
                  onClick={() => void handleSaveDepthChart()}
                  variant="default"
                  disabled={!hasUnsavedChanges || isSavingDepthChart}
                  className="min-h-10 min-w-[88px] shrink-0"
                  title={!hasUnsavedChanges ? "No changes to save" : undefined}
                >
                  {isSavingDepthChart ? "Saving…" : "Save"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleCloseDepthChart}
                disabled={isSavingDepthChart}
                aria-label="Close depth chart"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="min-h-0 min-w-0 flex-1 overflow-auto">
              <DepthChartView
                teamId={teamId}
                players={players}
                depthChart={depthChart}
                onUpdate={handleDepthChartChange}
                canEdit={canEdit}
                isHeadCoach={userRole === "HEAD_COACH"}
              />
            </div>
            {programId && canEdit && programHasJvOrFreshmanForCallups && (
              <div className="w-80 shrink-0 overflow-auto border-l border-border bg-muted/20 p-4">
                <CallUpSuggestionsPanel programId={programId} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Depth chart unsaved prompt: bottom sheet on mobile, centered on lg+ */}
      {showSavePrompt && (
        <>
          <div className="fixed inset-0 z-[60] lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Dismiss"
              onClick={() => setShowSavePrompt(false)}
            />
            <div
              className="absolute bottom-0 left-0 right-0 z-10 rounded-t-3xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
              <h3 className="text-lg font-semibold text-foreground">Unsaved changes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You have unsaved changes to the depth chart. What would you like to do?
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <Button
                  className="min-h-[48px] w-full rounded-xl"
                  disabled={isSavingDepthChart}
                  onClick={() => void handleSaveAndClose()}
                >
                  {isSavingDepthChart ? "Saving…" : "Save and exit"}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-[48px] w-full rounded-xl"
                  disabled={isSavingDepthChart}
                  onClick={handleDiscardAndClose}
                >
                  Exit without saving
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-[48px] w-full rounded-xl"
                  disabled={isSavingDepthChart}
                  onClick={handleCancelDepthChartSavePrompt}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
          <div className="hidden lg:fixed lg:inset-0 lg:z-[60] lg:flex lg:items-center lg:justify-center lg:bg-black/50 lg:p-4">
            <Card
              className="w-full max-w-md border border-border bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader>
                <CardTitle className="text-foreground">Unsaved Changes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You have unsaved changes to the depth chart. What would you like to do?
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
                  <Button variant="outline" disabled={isSavingDepthChart} onClick={handleCancelDepthChartSavePrompt}>
                    Cancel
                  </Button>
                  <Button variant="outline" disabled={isSavingDepthChart} onClick={handleDiscardAndClose}>
                    Exit without saving
                  </Button>
                  <Button disabled={isSavingDepthChart} onClick={() => void handleSaveAndClose()}>
                    {isSavingDepthChart ? "Saving…" : "Save and exit"}
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
