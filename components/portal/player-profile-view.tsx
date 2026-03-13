"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, BarChart3, Package, FileText, Save, Loader2, User, Camera, Trash2, FileUp, ExternalLink, History, Eye, EyeOff, CheckCircle2, XCircle, Mail, Phone, ClipboardList } from "lucide-react"
import type { PlayerProfile } from "@/types/player-profile"
import { PlayerProfileStatsForm } from "./player-profile-stats-form"

type TabId = "overview" | "info" | "stats" | "equipment" | "documents" | "notes" | "activity"

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "info", label: "Info" },
  { id: "stats", label: "Stats" },
  { id: "equipment", label: "Equipment" },
  { id: "documents", label: "Documents" },
  { id: "notes", label: "Notes" },
  { id: "activity", label: "Activity" },
]

interface PlayerProfileViewProps {
  playerId: string
  teamId: string
  canEdit: boolean
  isOwnProfile?: boolean
  backHref: string
}

export function PlayerProfileView({
  playerId,
  teamId,
  canEdit,
  isOwnProfile = false,
  backHref,
}: PlayerProfileViewProps) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [canEditProfile, setCanEditProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [saving, setSaving] = useState(false)
  const [editDraft, setEditDraft] = useState<Partial<PlayerProfile>>({})
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const hasEdits = Object.keys(editDraft).length > 0

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setPhotoError(null)
    setPhotoUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/roster/${playerId}/image`, { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Upload failed")
      }
      const data = await res.json()
      setProfile((p) => (p ? { ...p, imageUrl: (data as { imageUrl?: string }).imageUrl ?? p.imageUrl } : null))
      setSaveMessage({ type: "success", text: "Photo updated." })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setPhotoUploading(false)
      e.target.value = ""
    }
  }

  const handlePhotoRemove = async () => {
    if (!profile || photoUploading) return
    if (!confirm("Remove profile photo?")) return
    setPhotoError(null)
    setPhotoUploading(true)
    try {
      const res = await fetch(`/api/roster/${playerId}/image`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Remove failed")
      }
      setProfile((p) => (p ? { ...p, imageUrl: null } : null))
      setSaveMessage({ type: "success", text: "Photo removed." })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Remove failed")
    } finally {
      setPhotoUploading(false)
    }
  }

  useEffect(() => {
    if (!hasEdits) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [hasEdits])

  useEffect(() => {
    if (!saveMessage) return
    const t = setTimeout(() => setSaveMessage(null), 4000)
    return () => clearTimeout(t)
  }, [saveMessage])

  const refetchProfile = useCallback(() => {
    fetch(`/api/roster/${playerId}/profile?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => {
        if (!res.ok) return
        return res.json()
      })
      .then((data: { profile: PlayerProfile; canEdit: boolean } | undefined) => {
        if (data?.profile) {
          setProfile(data.profile)
          setCanEditProfile(data.canEdit)
        }
      })
      .catch(() => {})
  }, [playerId, teamId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/roster/${playerId}/profile?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "You can only view your own profile." : "Failed to load profile")
        return res.json()
      })
      .then((data: { profile: PlayerProfile; canEdit: boolean; isOwnProfile?: boolean }) => {
        if (!cancelled) {
          setProfile(data.profile)
          setCanEditProfile(data.canEdit)
          setEditDraft({})
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [playerId, teamId])

  const handleSave = async () => {
    if (!profile || !canEditProfile) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { teamId }
      if (editDraft.preferredName !== undefined) body.preferredName = editDraft.preferredName
      if (editDraft.playerEmail !== undefined) body.playerEmail = editDraft.playerEmail
      if (editDraft.playerPhone !== undefined) body.playerPhone = editDraft.playerPhone
      if (editDraft.address !== undefined) body.address = editDraft.address
      if (editDraft.emergencyContact !== undefined) body.emergencyContact = editDraft.emergencyContact
      if (canEdit) {
        if (editDraft.firstName !== undefined) body.firstName = editDraft.firstName
        if (editDraft.lastName !== undefined) body.lastName = editDraft.lastName
        if (editDraft.jerseyNumber !== undefined) body.jerseyNumber = editDraft.jerseyNumber
        if (editDraft.position !== undefined) body.position = editDraft.position
        if (editDraft.secondaryPosition !== undefined) body.secondaryPosition = editDraft.secondaryPosition
        if (editDraft.graduationYear !== undefined) body.graduationYear = editDraft.graduationYear
        if (editDraft.height !== undefined) body.height = editDraft.height
        if (editDraft.weight !== undefined) body.weight = editDraft.weight
        if (editDraft.dateOfBirth !== undefined) body.dateOfBirth = editDraft.dateOfBirth
        if (editDraft.school !== undefined) body.school = editDraft.school
        if (editDraft.parentGuardianContact !== undefined) body.parentGuardianContact = editDraft.parentGuardianContact
        if (editDraft.medicalNotes !== undefined) body.medicalNotes = editDraft.medicalNotes
        if (editDraft.activeStatus !== undefined) body.activeStatus = editDraft.activeStatus
        if (editDraft.eligibilityStatus !== undefined) body.eligibilityStatus = editDraft.eligibilityStatus
        if (editDraft.roleDepthNotes !== undefined) body.roleDepthNotes = editDraft.roleDepthNotes
        if (editDraft.coachNotes !== undefined) body.coachNotes = editDraft.coachNotes
        if (editDraft.profileNotes !== undefined) body.profileNotes = editDraft.profileNotes
        if (editDraft.notes !== undefined) body.notes = editDraft.notes
        if (editDraft.seasonStats !== undefined) body.seasonStats = editDraft.seasonStats
        if (editDraft.gameStats !== undefined) body.gameStats = editDraft.gameStats
        if (editDraft.practiceMetrics !== undefined) body.practiceMetrics = editDraft.practiceMetrics
      }
      const res = await fetch(`/api/roster/${playerId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Failed to save")
      }
      const data = await res.json()
      setProfile(data.profile)
      setEditDraft({})
      setSaveMessage({ type: "success", text: "Profile saved." })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save"
      setSaveMessage({ type: "error", text: message })
    } finally {
      setSaving(false)
    }
  }

  const getDisplayName = () => {
    if (!profile) return ""
    return profile.preferredName?.trim() || `${profile.firstName} ${profile.lastName}`.trim() || "Player"
  }

  const getStatusColor = () => {
    const s = profile?.healthStatus ?? profile?.activeStatus ?? "active"
    if (s === "injured") return "bg-red-100 text-red-700 border-red-200"
    if (s === "unavailable" || s === "inactive") return "bg-orange-100 text-orange-700 border-orange-200"
    return "bg-green-100 text-green-700 border-green-200"
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <Card className="overflow-hidden border-[rgb(var(--border))]">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-[#E2E8F0]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-6 w-48 animate-pulse rounded bg-[#E2E8F0]" />
                  <div className="h-4 w-32 animate-pulse rounded bg-[#E2E8F0]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="rounded-lg border border-[rgb(var(--border))] bg-white p-6 text-center">
        <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>{error ?? "Profile not found."}</p>
        <Link href={backHref}>
          <Button variant="outline" className="mt-4">Back to Roster</Button>
        </Link>
      </div>
    )
  }

  const value = (key: keyof PlayerProfile) => (editDraft[key] !== undefined ? editDraft[key] : (profile as unknown as Record<string, unknown>)[key as string])

  return (
    <div className="space-y-6 pb-8">
      {/* Back + Header: polished summary card */}
      <Card className="overflow-hidden border-[rgb(var(--border))]">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Link href={backHref} className="shrink-0">
                <Button variant="ghost" size="icon" aria-label="Back to roster">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="relative shrink-0">
                <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--platinum))]">
                  {profile.imageUrl && profile.imageUrl.trim() ? (
                    <Image src={profile.imageUrl} alt="" fill className="object-cover" unoptimized sizes="64px" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xl font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      {(profile.firstName?.[0] ?? "") + (profile.lastName?.[0] ?? "") || "?"}
                    </span>
                  )}
                </div>
                {canEditProfile && (
                  <div className="mt-2 flex flex-col gap-1">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={photoUploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={photoUploading}
                    >
                      {photoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      <span className="ml-1">{photoUploading ? "Uploading..." : "Change photo"}</span>
                    </Button>
                    {profile.imageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={handlePhotoRemove}
                        disabled={photoUploading}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="ml-1">Remove</span>
                      </Button>
                    )}
                    {photoError && (
                      <p className="text-xs text-red-600">{photoError}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-semibold text-[#0F172A] sm:text-2xl">{getDisplayName()}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#64748B]">
                  {profile.jerseyNumber != null && <span className="font-medium text-[#0F172A]">#{profile.jerseyNumber}</span>}
                  {profile.position && <span>{profile.position}</span>}
                  {profile.teamName && <span>{profile.teamName}</span>}
                  <span className={`rounded border px-2 py-0.5 text-xs font-medium ${getStatusColor()}`}>
                    {profile.healthStatus === "injured" ? "Injured" : profile.activeStatus === "inactive" ? "Inactive" : "Active"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              {saveMessage && (
                <span
                  className={`rounded-md px-3 py-1.5 text-sm ${saveMessage.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  role="status"
                >
                  {saveMessage.text}
                </span>
              )}
              {canEditProfile && hasEdits && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span className="ml-2">{saving ? "Saving..." : "Save changes"}</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: scroll on mobile, clear hierarchy */}
      <div className="border-b border-[#E5E7EB] -mx-2 px-2 sm:mx-0 sm:px-0">
        <nav className="flex gap-1 overflow-x-auto pb-px scrollbar-thin" aria-label="Profile sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors rounded-t ${
                activeTab === tab.id
                  ? "border-[#0B2A5B] text-[#0F172A] bg-[#F8FAFC]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <Card>
        <CardContent className="pt-6">
          {activeTab === "overview" && (
            <OverviewTab profile={profile} playerId={playerId} teamId={teamId} canEdit={canEditProfile} editDraft={editDraft} setEditDraft={setEditDraft} value={value} />
          )}
          {activeTab === "info" && (
            <InfoTab profile={profile} playerId={playerId} teamId={teamId} canEdit={canEditProfile} editDraft={editDraft} setEditDraft={setEditDraft} value={value} />
          )}
          {activeTab === "stats" && (
            <StatsTab profile={profile} canEdit={canEditProfile} editDraft={editDraft} setEditDraft={setEditDraft} value={value} />
          )}
          {activeTab === "equipment" && (
            <EquipmentTab
              profile={profile}
              teamId={teamId}
              playerId={playerId}
              canEdit={canEditProfile}
              onProfileRefetch={refetchProfile}
            />
          )}
          {activeTab === "documents" && (
            <DocumentsTab playerId={playerId} teamId={teamId} canEdit={canEditProfile} />
          )}
          {activeTab === "notes" && (
            <NotesTab profile={profile} canEdit={canEditProfile} editDraft={editDraft} setEditDraft={setEditDraft} value={value} />
          )}
          {activeTab === "activity" && (
            <ActivityTab playerId={playerId} teamId={teamId} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type ReadinessResponse = {
  profileComplete: boolean
  physicalOnFile: boolean
  waiverOnFile: boolean
  eligibilityOnFile: boolean
  eligibilityStatus: string | null
  requiredDocsComplete: boolean
  equipmentAssigned: boolean
  assignedEquipmentCount: number
  missingItems: string[]
  ready: boolean
}

const FOLLOW_UP_CATEGORY_LABELS: Record<string, string> = {
  physical_follow_up: "Physical follow-up",
  waiver_reminder: "Waiver reminder",
  eligibility_review: "Eligibility review",
  guardian_contact_follow_up: "Guardian/contact follow-up",
  equipment_follow_up: "Equipment follow-up",
  other: "Other",
}

type FollowUpItem = {
  id: string
  playerId: string
  teamId: string
  category: string
  status: string
  note: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

function FollowUpsSection({ playerId, teamId, canEdit }: { playerId: string; teamId: string; canEdit: boolean }) {
  const [list, setList] = useState<FollowUpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addCategory, setAddCategory] = useState("physical_follow_up")
  const [addNote, setAddNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/roster/${playerId}/follow-ups?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FollowUpItem[]) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [playerId, teamId])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/roster/${playerId}/follow-ups?teamId=${encodeURIComponent(teamId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: addCategory, note: addNote.trim() || undefined }),
      })
      if (!res.ok) throw new Error("Failed to add")
      setShowAdd(false)
      setAddNote("")
      load()
    } catch {
      setSubmitting(false)
      return
    }
    setSubmitting(false)
  }

  const handleResolve = async (id: string) => {
    setResolvingId(id)
    try {
      const res = await fetch(`/api/roster/${playerId}/follow-ups/${id}?teamId=${encodeURIComponent(teamId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
      if (!res.ok) throw new Error("Failed to resolve")
      load()
    } finally {
      setResolvingId(null)
    }
  }

  const openList = list.filter((f) => f.status === "open")
  const resolvedList = list.filter((f) => f.status === "resolved")

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4" />
        Follow-ups
      </h3>
      {loading ? (
        <p className="text-sm text-[#94A3B8]">Loading...</p>
      ) : (
        <>
          {openList.length === 0 && resolvedList.length === 0 ? (
            <p className="text-sm text-[#64748B]">No follow-ups. Coaches can add follow-ups from this section or from the roster Readiness tab.</p>
          ) : (
            <ul className="space-y-2">
              {openList.map((f) => (
                <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <div>
                    <span className="font-medium text-amber-800">{FOLLOW_UP_CATEGORY_LABELS[f.category] ?? f.category}</span>
                    {f.note && <p className="mt-0.5 text-sm text-[#64748B]">{f.note}</p>}
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {f.createdBy && `Added by ${f.createdBy} · `}
                      {new Date(f.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={resolvingId === f.id}
                      onClick={() => handleResolve(f.id)}
                    >
                      {resolvingId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark resolved"}
                    </Button>
                  )}
                </li>
              ))}
              {resolvedList.slice(0, 5).map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-2 text-sm text-[#64748B]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  <span>{FOLLOW_UP_CATEGORY_LABELS[f.category] ?? f.category}</span>
                  <span className="text-xs">Resolved {f.resolvedAt ? new Date(f.resolvedAt).toLocaleDateString() : ""}</span>
                </li>
              ))}
              {resolvedList.length > 5 && <p className="text-xs text-[#94A3B8]">+{resolvedList.length - 5} more resolved</p>}
            </ul>
          )}
          {canEdit && (
            <div className="mt-3">
              {!showAdd ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)}>
                  Add follow-up
                </Button>
              ) : (
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-2">
                  <Label className="text-xs">Type</Label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
                  >
                    {Object.entries(FOLLOW_UP_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <Label className="text-xs">Note (optional)</Label>
                  <textarea
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    placeholder="e.g. Call parent by Friday"
                    className="w-full min-h-[60px] rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreate} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setAddNote("") }} disabled={submitting}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function OverviewTab({
  profile,
  playerId,
  teamId,
  canEdit,
  editDraft,
  setEditDraft,
  value,
}: {
  profile: PlayerProfile
  playerId: string
  teamId: string
  canEdit: boolean
  editDraft: Partial<PlayerProfile>
  setEditDraft: (d: Partial<PlayerProfile> | ((prev: Partial<PlayerProfile>) => Partial<PlayerProfile>)) => void
  value: (k: keyof PlayerProfile) => unknown
}) {
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null)
  useEffect(() => {
    fetch(`/api/roster/${playerId}/readiness?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReadinessResponse | null) => setReadiness(data))
      .catch(() => setReadiness(null))
  }, [playerId, teamId])

  const readOnlyClass = "rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A]"
  const statusLabel = profile.healthStatus === "injured" ? "Injured" : profile.activeStatus === "inactive" ? "Inactive" : "Active"
  return (
    <div className="space-y-6">
      {/* Readiness / compliance */}
      {readiness && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">Readiness</h3>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {readiness.ready ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-2.5 py-1 text-sm font-medium text-green-800">
                <CheckCircle2 className="h-4 w-4" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-800">
                <XCircle className="h-4 w-4" /> Incomplete
              </span>
            )}
            {readiness.eligibilityStatus && (
              <span className="text-sm text-[#64748B]">Eligibility: {readiness.eligibilityStatus}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { ok: readiness.profileComplete, label: "Profile complete" },
              { ok: readiness.physicalOnFile, label: "Physical on file" },
              { ok: readiness.waiverOnFile, label: "Waiver on file" },
              { ok: readiness.requiredDocsComplete, label: "Required documents" },
              { ok: readiness.equipmentAssigned, label: readiness.assignedEquipmentCount > 0 ? `Equipment (${readiness.assignedEquipmentCount})` : "Equipment" },
            ].map(({ ok, label }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
              >
                {ok ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
                {label}
              </span>
            ))}
          </div>
          {!readiness.ready && readiness.missingItems.length > 0 && (
            <p className="mt-2 text-xs text-[#64748B]">
              Missing: {readiness.missingItems.join("; ")}
            </p>
          )}
        </div>
      )}

      {/* Follow-ups (coach intervention tracking) */}
      <FollowUpsSection playerId={playerId} teamId={teamId} canEdit={canEdit} />

      {/* Contact card */}
      <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">Contact</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
          {profile.playerEmail?.trim() && (
            <a href={`mailto:${profile.playerEmail.trim()}`} className="inline-flex items-center gap-2 text-sm text-[#0F172A] hover:text-[#3B82F6]">
              <Mail className="h-4 w-4 shrink-0" /> {profile.playerEmail.trim()}
            </a>
          )}
          {profile.playerPhone?.trim() && (
            <a href={`tel:${profile.playerPhone.trim().replace(/\D/g, "")}`} className="inline-flex items-center gap-2 text-sm text-[#0F172A] hover:text-[#3B82F6]">
              <Phone className="h-4 w-4 shrink-0" /> {profile.playerPhone.trim()}
            </a>
          )}
          {profile.parentGuardianContact?.trim() && (
            <div className="text-sm">
              <span className="text-[#64748B]">Parent/guardian: </span>
              <span className="text-[#0F172A]">{profile.parentGuardianContact.trim()}</span>
            </div>
          )}
          {!profile.playerEmail?.trim() && !profile.playerPhone?.trim() && !profile.parentGuardianContact?.trim() && (
            <p className="text-sm text-[#94A3B8]">No contact info on file. Add in Info tab.</p>
          )}
        </div>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border border-[#E5E7EB] bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">At a glance</h3>
        <div className="flex flex-wrap items-center gap-3">
          {profile.jerseyNumber != null && (
            <span className="rounded-lg bg-[#0F172A] px-3 py-1.5 text-sm font-bold text-white">
              #{profile.jerseyNumber}
            </span>
          )}
          {profile.position && (
            <span className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#0F172A]">
              {profile.position}
            </span>
          )}
          <span className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#64748B]">
            {profile.teamName ?? "—"}
          </span>
          <span className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            profile.healthStatus === "injured" ? "bg-red-100 text-red-800" :
            profile.activeStatus === "inactive" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
          }`}>
            {statusLabel}
          </span>
        </div>
      </div>
      <p className="text-sm text-[#64748B]">Quick summary. Use the Info tab for full details.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Name</Label>
          <p className={readOnlyClass}>
            {profile.firstName} {profile.lastName}
            {profile.preferredName && <span className="text-[#64748B]"> ({profile.preferredName})</span>}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Jersey #</Label>
          <p className={readOnlyClass}>{profile.jerseyNumber ?? "—"}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Position</Label>
          <p className={readOnlyClass}>{profile.position ?? "—"}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Team</Label>
          <p className={readOnlyClass}>{profile.teamName ?? "—"}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Status</Label>
          <p className={readOnlyClass}>
            {profile.healthStatus === "injured" ? "Injured" : profile.activeStatus === "inactive" ? "Inactive" : "Active"}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Email</Label>
          {canEdit ? (
            <Input
              type="email"
              value={String(value("playerEmail") ?? "")}
              onChange={(e) => setEditDraft((p) => ({ ...p, playerEmail: e.target.value || null }))}
              placeholder="Player email"
              className="max-w-sm"
            />
          ) : (
            <p className={readOnlyClass}>{profile.playerEmail ?? "—"}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Phone</Label>
          {canEdit ? (
            <Input
              value={String(value("playerPhone") ?? "")}
              onChange={(e) => setEditDraft((p) => ({ ...p, playerPhone: e.target.value || null }))}
              placeholder="Player phone"
              className="max-w-sm"
            />
          ) : (
            <p className={readOnlyClass}>{profile.playerPhone ?? "—"}</p>
          )}
        </div>
      </div>
    </div>
  )
}

type LinkedGuardian = {
  linkId: string
  guardianId: string
  relationship: string | null
  verified: boolean
  name: string
  email: string | null
  phone: string | null
}

function LinkedGuardiansSection({ playerId, teamId }: { playerId: string; teamId: string }) {
  const [guardians, setGuardians] = useState<LinkedGuardian[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/roster/${playerId}/guardians?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: LinkedGuardian[]) => setGuardians(Array.isArray(data) ? data : []))
      .catch(() => setGuardians([]))
      .finally(() => setLoading(false))
  }, [playerId, teamId])

  if (loading) {
    return (
      <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Linked guardians</p>
        <p className="mt-1 text-sm text-[#94A3B8]">Loading...</p>
      </div>
    )
  }

  if (guardians.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Linked guardians</p>
        <p className="mt-1 text-sm text-[#64748B]">No guardians linked yet.</p>
        <p className="mt-1 text-xs text-[#94A3B8]">To link a parent/guardian, use Team settings or the guardian invite flow when available.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">Linked guardians</p>
      <ul className="space-y-3">
        {guardians.map((g) => (
          <li key={g.linkId} className="flex flex-col gap-1 rounded-md border border-[#E2E8F0] bg-white px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-[#0F172A]">{g.name}</span>
              {g.relationship && <span className="text-[#64748B] text-xs">({g.relationship})</span>}
              {g.verified && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">Verified</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#475569]">
              {g.email && (
                <a href={`mailto:${g.email}`} className="text-[#3B82F6] hover:underline">{g.email}</a>
              )}
              {g.phone && (
                <a href={`tel:${g.phone.replace(/\D/g, "")}`} className="text-[#3B82F6] hover:underline">{g.phone}</a>
              )}
              {!g.email && !g.phone && <span className="text-[#94A3B8]">No contact on file</span>}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[#94A3B8]">To add or unlink guardians, use Team settings when available.</p>
    </div>
  )
}

function InfoTab({
  profile,
  playerId,
  teamId,
  canEdit,
  editDraft,
  setEditDraft,
  value,
}: {
  profile: PlayerProfile
  playerId: string
  teamId: string
  canEdit: boolean
  editDraft: Partial<PlayerProfile>
  setEditDraft: (d: Partial<PlayerProfile> | ((prev: Partial<PlayerProfile>) => Partial<PlayerProfile>)) => void
  value: (k: keyof PlayerProfile) => unknown
}) {
  const fields: { key: keyof PlayerProfile; label: string; type?: string }[] = [
    { key: "firstName", label: "First name" },
    { key: "lastName", label: "Last name" },
    { key: "preferredName", label: "Preferred name / Nickname" },
    { key: "jerseyNumber", label: "Jersey number" },
    { key: "position", label: "Position" },
    { key: "secondaryPosition", label: "Secondary position" },
    { key: "graduationYear", label: "Class / Graduation year" },
    { key: "height", label: "Height" },
    { key: "weight", label: "Weight (lbs)" },
    { key: "dateOfBirth", label: "Date of birth" },
    { key: "school", label: "School" },
    { key: "parentGuardianContact", label: "Parent/Guardian contact" },
    { key: "playerEmail", label: "Player email" },
    { key: "playerPhone", label: "Player phone" },
    { key: "address", label: "Address" },
    { key: "emergencyContact", label: "Emergency contact" },
    { key: "medicalNotes", label: "Medical notes / Alerts" },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <Label className="text-[#64748B]">{label}</Label>
            {canEdit ? (
              key === "weight" || key === "jerseyNumber" || key === "graduationYear" ? (
                <Input
                  type="number"
                  value={value(key) != null ? String(value(key)) : ""}
                  onChange={(e) => setEditDraft((p) => ({ ...p, [key]: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="—"
                />
              ) : (
                <Input
                  value={String(value(key) ?? "")}
                  onChange={(e) => setEditDraft((p) => ({ ...p, [key]: e.target.value || null }))}
                  placeholder="—"
                />
              )
            ) : (
              <p className="min-h-[2.5rem] rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A]">
                {(profile as unknown as Record<string, unknown>)[key as string] != null && (profile as unknown as Record<string, unknown>)[key as string] !== ""
                  ? String((profile as unknown as Record<string, unknown>)[key as string])
                  : "—"}
              </p>
            )}
          </div>
        ))}
      </div>
      {/* Guardian linkage: show linked guardians when data exists */}
      <LinkedGuardiansSection playerId={playerId} teamId={teamId} />
    </div>
  )
}

function StatsTab({
  profile,
  canEdit,
  editDraft,
  setEditDraft,
  value,
}: {
  profile: PlayerProfile
  canEdit: boolean
  editDraft: Partial<PlayerProfile>
  setEditDraft: (d: Partial<PlayerProfile> | ((prev: Partial<PlayerProfile>) => Partial<PlayerProfile>)) => void
  value: (k: keyof PlayerProfile) => unknown
}) {
  const seasonStats = profile.seasonStats && typeof profile.seasonStats === "object" ? (profile.seasonStats as Record<string, unknown>) : {}
  const seasonEntries = Object.entries(seasonStats).filter(([, v]) => v != null && v !== "")
  const gameStats = Array.isArray(profile.gameStats) ? profile.gameStats : []
  const hasStats = seasonEntries.length > 0 || gameStats.length > 0

  return (
    <div className="space-y-6">
      {canEdit && (
        <>
          <PlayerProfileStatsForm
            profile={profile}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            value={value}
          />
          <div className="border-t border-[#E5E7EB] pt-6">
            <Label className="text-[#64748B]">Coach notes on performance</Label>
            <textarea
              className="mt-2 min-h-[100px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A]"
              value={String(value("coachNotes") ?? "")}
              onChange={(e) => setEditDraft((p) => ({ ...p, coachNotes: e.target.value || null }))}
              placeholder="Notes on performance..."
            />
          </div>
        </>
      )}
      {!canEdit && profile.coachNotes && (
        <div className="space-y-2">
          <Label className="text-[#64748B]">Coach notes</Label>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <p className="whitespace-pre-wrap break-words text-sm text-[#0F172A]">{profile.coachNotes}</p>
          </div>
        </div>
      )}
      {hasStats ? (
        <div className="space-y-8">
          {seasonEntries.length > 0 && (
            <div>
              <Label className="text-[#0F172A] font-medium">Season summary</Label>
              <p className="mt-1 text-xs text-[#64748B]">Season totals. Custom stats shown in All stats.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { group: "Offense", keys: ["passing_yards", "rushing_yards", "receptions", "receiving_yards", "touchdowns"], label: "Offense" },
                  { group: "Defense", keys: ["tackles", "interceptions"], label: "Defense" },
                  { group: "General", keys: ["games_played"], label: "Games" },
                ].map(({ keys, label }) => {
                  const groupEntries = seasonEntries.filter(([k]) => keys.includes(k.replace(/-/g, "_")))
                  if (groupEntries.length === 0) return null
                  const displayLabel = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  return (
                    <div key={label} className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">{label}</p>
                      <dl className="space-y-1.5">
                        {groupEntries.map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2">
                            <dt className="text-sm text-[#64748B]">{displayLabel(k)}</dt>
                            <dd className="text-sm font-medium text-[#0F172A]">{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )
                })}
              </div>
              {seasonEntries.some(([k]) => !["games_played", "passing_yards", "rushing_yards", "receptions", "receiving_yards", "touchdowns", "tackles", "interceptions"].includes(k)) && (
                <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">All stats</p>
                  <dl className="flex flex-wrap gap-x-4 gap-y-1">
                    {seasonEntries.map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="text-sm text-[#64748B]">{k.replace(/_/g, " ")}:</dt>
                        <dd className="text-sm text-[#0F172A]">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
          {gameStats.length > 0 && (
            <div>
              <Label className="text-[#0F172A] font-medium">Game log</Label>
              <p className="mt-1 text-xs text-[#64748B]">Recent games. Most recent first.</p>
              <div className="mt-3 space-y-2">
                {gameStats.slice(0, 20).map((g, i) => {
                  const row = g && typeof g === "object" ? (g as Record<string, unknown>) : {}
                  const date = row.date ?? row.Date
                  const opponent = row.opponent ?? row.Opponent
                  const notes = row.notes ?? row.Notes
                  const rest = Object.entries(row).filter(([k]) => !["date", "opponent", "notes", "Date", "Opponent", "Notes"].includes(k))
                  return (
                    <div key={i} className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-[#0F172A]">{date ? String(date) : "—"}</span>
                        <span className="text-sm text-[#64748B]">{opponent ? String(opponent) : "—"}</span>
                      </div>
                      {notes != null && notes !== "" ? <p className="mt-1 text-sm text-[#475569]">{String(notes)}</p> : null}
                      {rest.length > 0 && (
                        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                          {rest.map(([k, v]) => {
                            const display = String(v ?? "—")
                            return (
                              <span key={k} className="text-[#64748B]">{k.replace(/_/g, " ")}: <span className="text-[#0F172A]">{display}</span></span>
                            )
                          })}
                        </dl>
                      )}
                    </div>
                  )
                })}
              </div>
              {gameStats.length > 20 && <p className="mt-2 text-xs text-[#94A3B8]">Showing last 20 games.</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-8 text-center">
          <p className="text-sm text-[#64748B]">No stats recorded yet.</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Season and game stats will appear here when added.</p>
        </div>
      )}
    </div>
  )
}

type InventoryItem = {
  id: string
  category: string
  name: string
  quantityAvailable: number
  assignedToPlayerId: string | null
  assignedPlayer?: { id: string; firstName: string; lastName: string } | null
}

function EquipmentTab({
  profile,
  teamId,
  playerId,
  canEdit,
  onProfileRefetch,
}: {
  profile: PlayerProfile
  teamId: string
  playerId: string
  canEdit: boolean
  onProfileRefetch?: () => void
}) {
  const items = profile.assignedItems ?? []
  const manualEquipment = profile.assignedEquipment && typeof profile.assignedEquipment === "object" ? Object.entries(profile.assignedEquipment as Record<string, unknown>) : []
  const hasManual = manualEquipment.length > 0
  const hasInventory = items.length > 0
  const hasNotes = !!profile.equipmentIssueReturnNotes?.trim()

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [assignItemId, setAssignItemId] = useState<string | null>(null)
  const [equipmentError, setEquipmentError] = useState<string | null>(null)
  const [equipmentActivity, setEquipmentActivity] = useState<{ id: string; actionType: string; metadata: Record<string, unknown>; createdAt: string }[]>([])

  useEffect(() => {
    fetch(`/api/roster/${playerId}/activity?teamId=${encodeURIComponent(teamId)}&limit=50`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; actionType: string; metadata?: Record<string, unknown>; createdAt: string }[]) => {
        const equipment = (Array.isArray(data) ? data : [])
          .filter((a) => a.actionType === "equipment_assigned" || a.actionType === "equipment_unassigned")
          .map((a) => ({ ...a, metadata: a.metadata ?? {} }))
        setEquipmentActivity(equipment.slice(0, 15))
      })
      .catch(() => setEquipmentActivity([]))
  }, [playerId, teamId])

  useEffect(() => {
    if (!canEdit || !teamId) return
    setInventoryLoading(true)
    fetch(`/api/teams/${teamId}/inventory`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { items?: InventoryItem[] }) => setInventoryList(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setInventoryList([]))
      .finally(() => setInventoryLoading(false))
  }, [canEdit, teamId])

  const availableToAssign = inventoryList.filter((i) => !i.assignedToPlayerId)
  const assignedToThisPlayer = inventoryList.filter((i) => i.assignedToPlayerId === playerId)

  const handleAssign = async (itemId: string) => {
    setEquipmentError(null)
    setAssignItemId(itemId)
    try {
      const res = await fetch(`/api/teams/${teamId}/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToPlayerId: playerId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Assign failed")
      }
      onProfileRefetch?.()
      setInventoryList((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, assignedToPlayerId: playerId } : i))
      )
    } catch (err) {
      setEquipmentError(err instanceof Error ? err.message : "Assign failed")
    } finally {
      setAssignItemId(null)
    }
  }

  const handleUnassign = async (itemId: string) => {
    setEquipmentError(null)
    setAssignItemId(itemId)
    try {
      const res = await fetch(`/api/teams/${teamId}/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToPlayerId: null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Unassign failed")
      }
      onProfileRefetch?.()
      setInventoryList((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, assignedToPlayerId: null } : i))
      )
    } catch (err) {
      setEquipmentError(err instanceof Error ? err.message : "Unassign failed")
    } finally {
      setAssignItemId(null)
    }
  }

  return (
    <div className="space-y-6">
      {equipmentError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{equipmentError}</p>
      )}
      {canEdit && !inventoryLoading && availableToAssign.length > 0 && (
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <Label className="text-[#0F172A] font-medium">Assign from team inventory</Label>
          <p className="mt-1 text-xs text-[#64748B]">Assign available gear to this player.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              id="equipment-select"
              className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] min-w-[180px]"
              defaultValue=""
            >
              <option value="">Select item...</option>
              {availableToAssign.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.category})
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const sel = document.getElementById("equipment-select") as HTMLSelectElement
                const id = sel?.value
                if (id) handleAssign(id)
              }}
              disabled={!!assignItemId}
            >
              {assignItemId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
            </Button>
          </div>
        </div>
      )}
      {equipmentActivity.length > 0 && (
        <div className="space-y-2">
          <Label className="text-[#64748B]">Assignment history</Label>
          <p className="text-xs text-[#94A3B8]">Recent assign/unassign from team inventory.</p>
          <ul className="divide-y divide-[#E5E7EB] rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
            {equipmentActivity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className={a.actionType === "equipment_assigned" ? "text-green-700" : "text-amber-700"}>
                  {a.actionType === "equipment_assigned" ? "Assigned" : "Returned"}{" "}
                  {(a.metadata?.itemName as string) ?? "item"}
                </span>
                <span className="text-xs text-[#94A3B8]">{formatActivityTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasNotes && (
        <div className="space-y-2">
          <Label className="text-[#64748B]">Issue / Return notes</Label>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <p className="whitespace-pre-wrap break-words text-sm text-[#0F172A]">{profile.equipmentIssueReturnNotes}</p>
          </div>
        </div>
      )}
      {hasInventory || (canEdit && assignedToThisPlayer.length > 0) ? (
        <div className="space-y-2">
          <Label className="text-[#64748B]">From team inventory</Label>
          <p className="text-xs text-[#94A3B8]">
            {canEdit ? "Assigned from team inventory. Unassign to return to pool." : "Assigned via team inventory."}
          </p>
          <ul className="divide-y divide-[#E5E7EB] rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] overflow-hidden">
            {(canEdit ? assignedToThisPlayer : items).map((i) => {
              const name = (i as { name?: string }).name ?? ""
              const category = (i as { category?: string }).category ?? ""
              const condition = (i as { condition?: string }).condition ?? ""
              const status = (i as { status?: string }).status ?? ""
              const id = (i as { id?: string }).id ?? ""
              return (
                <li key={id || name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <span className="font-medium text-[#0F172A]">{name}</span>
                    <span className="ml-2 text-sm text-[#64748B]">
                      {[category, condition, status].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                  {canEdit && id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 shrink-0"
                      onClick={() => handleUnassign(id)}
                      disabled={assignItemId === id}
                    >
                      {assignItemId === id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unassign"}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-6 text-center">
          <p className="text-sm text-[#64748B]">No equipment assigned from team inventory.</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Assign gear in the Inventory section.</p>
        </div>
      )}
      {hasManual && (
        <div className="space-y-2">
          <Label className="text-[#64748B]">Other / manual equipment notes</Label>
          <p className="text-xs text-[#94A3B8]">Manually tracked items (e.g. helmet size, jersey).</p>
          <dl className="divide-y divide-[#E5E7EB] rounded-lg border border-[#E5E7EB] bg-[#F8FAFC]">
            {manualEquipment.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2">
                <dt className="text-sm font-medium text-[#64748B]">{k}</dt>
                <dd className="text-sm text-[#0F172A]">{v != null ? String(v) : "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

const DOC_CATEGORIES = ["all", "waiver", "physical", "eligibility", "form", "other"] as const
/** Categories that satisfy required compliance for readiness. */
const REQUIRED_DOC_CATEGORIES = ["physical", "waiver"]

type PlayerDocument = {
  id: string
  title: string
  fileName: string
  fileUrl: string | null
  fileSize: number | null
  mimeType?: string | null
  category: string
  createdAt: string
  visibleToPlayer?: boolean
  createdBy?: string | null
}

function getFileTypeBadge(fileName: string, mimeType?: string | null): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  if (mimeType?.includes("pdf") || ext === "pdf") return "PDF"
  if (["doc", "docx"].includes(ext)) return "Word"
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "Image"
  return ext ? ext.toUpperCase() : "File"
}

function formatDocDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function DocumentsTab({
  playerId,
  teamId,
  canEdit,
}: {
  playerId: string
  teamId: string
  canEdit: boolean
}) {
  const [docs, setDocs] = useState<PlayerDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [visibilityTogglingId, setVisibilityTogglingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(() => {
    setLoading(true)
    fetch(`/api/roster/${playerId}/documents?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PlayerDocument[]) => setDocs(Array.isArray(data) ? data : []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [playerId, teamId])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  const filteredDocs = categoryFilter === "all"
    ? docs
    : docs.filter((d) => d.category === categoryFilter)

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const file = (form.elements.namedItem("docFile") as HTMLInputElement)?.files?.[0]
    const title = (form.elements.namedItem("docTitle") as HTMLInputElement)?.value?.trim() || "Document"
    const visibleToPlayer = (form.elements.namedItem("docVisibleToPlayer") as HTMLInputElement)?.checked !== false
    if (!file) {
      setUploadError("Select a file")
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", title)
      formData.append("category", (form.elements.namedItem("docCategory") as HTMLSelectElement)?.value || "other")
      formData.append("visibleToPlayer", String(visibleToPlayer))
      const res = await fetch(`/api/roster/${playerId}/documents`, { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Upload failed")
      }
      loadDocs()
      form.reset()
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document?")) return
    setDeleteId(docId)
    try {
      const res = await fetch(`/api/roster/${playerId}/documents/${docId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      loadDocs()
    } catch {
      setUploadError("Failed to delete")
    } finally {
      setDeleteId(null)
    }
  }

  const handleVisibilityToggle = async (docId: string, current: boolean) => {
    setVisibilityTogglingId(docId)
    try {
      const res = await fetch(`/api/roster/${playerId}/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibleToPlayer: !current }),
      })
      if (!res.ok) throw new Error("Update failed")
      setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, visibleToPlayer: !current } : d)))
    } catch {
      setUploadError("Failed to update visibility")
    } finally {
      setVisibilityTogglingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
        <p className="text-sm text-[#64748B]">Loading documents...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <Label className="text-[#0F172A] font-medium">Upload document</Label>
          <p className="mt-1 text-xs text-[#64748B]">PDF, images, or Word. Max 15MB.</p>
          <form onSubmit={handleUpload} className="mt-3 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
              <input ref={fileInputRef} type="file" name="docFile" accept=".pdf,image/*,.doc,.docx,.txt" className="max-w-xs text-sm" required />
              <Input name="docTitle" placeholder="Title" className="max-w-[200px]" />
              <select name="docCategory" className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm min-w-[140px]" aria-label="Document category">
                {DOC_CATEGORIES.filter((c) => c !== "all").map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                    {REQUIRED_DOC_CATEGORIES.includes(c) ? " (required)" : ""}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-[#64748B]">
                <input type="checkbox" name="docVisibleToPlayer" defaultChecked className="rounded border-[#E5E7EB]" />
                Visible to player
              </label>
              <Button type="submit" disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                <span className="ml-2">{uploading ? "Uploading..." : "Upload"}</span>
              </Button>
            </div>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          </form>
        </div>
      )}

      {docs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-[#64748B] text-sm">Category</Label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
          >
            {DOC_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
      )}

      {filteredDocs.length > 0 ? (
        <ul className="divide-y divide-[#E5E7EB] rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
          {filteredDocs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#E2E8F0] px-2 py-0.5 text-xs font-medium text-[#475569]">
                    {getFileTypeBadge(d.fileName, d.mimeType)}
                  </span>
                  <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-xs text-[#64748B] capitalize">{d.category}</span>
                  {REQUIRED_DOC_CATEGORIES.includes(d.category) && (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Required for compliance</span>
                  )}
                  {canEdit && d.visibleToPlayer === false && (
                    <span className="text-xs text-amber-600">Hidden from player</span>
                  )}
                </div>
                <a
                  href={d.fileUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 font-medium text-[#0F172A] hover:text-[#3B82F6] flex items-center gap-1 inline-flex"
                >
                  {d.title}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {d.fileName}
                  {d.createdBy && ` · Uploaded by ${d.createdBy}`}
                  {d.createdAt && ` · ${formatDocDate(d.createdAt)}`}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#64748B]"
                    title={d.visibleToPlayer !== false ? "Hide from player" : "Show to player"}
                    onClick={() => handleVisibilityToggle(d.id, d.visibleToPlayer !== false)}
                    disabled={visibilityTogglingId === d.id}
                  >
                    {visibilityTogglingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (d.visibleToPlayer !== false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />)}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleDelete(d.id)}
                    disabled={deleteId === d.id}
                  >
                    {deleteId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-8 text-center">
          <p className="text-sm text-[#64748B]">
            {docs.length === 0 ? "No documents yet." : `No documents in ${categoryFilter === "all" ? "any" : categoryFilter} category.`}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">{canEdit ? "Upload forms, waivers, or eligibility docs above." : "Documents will appear here when added."}</p>
        </div>
      )}
    </div>
  )
}

const ACTIVITY_LABELS: Record<string, string> = {
  photo_changed: "Profile photo updated",
  photo_removed: "Profile photo removed",
  profile_updated: "Profile updated",
  equipment_assigned: "Equipment assigned",
  equipment_unassigned: "Equipment unassigned",
  document_uploaded: "Document uploaded",
  document_deleted: "Document removed",
  stats_updated: "Stats updated",
  follow_up_created: "Follow-up added",
  follow_up_resolved: "Follow-up resolved",
}

function formatActivityTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

type ActivityItem = {
  id: string
  actionType: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  actor: { name: string | null; email: string } | null
}

const ACTIVITY_TYPE_OPTIONS = [
  { value: "", label: "All activity" },
  { value: "profile_updated", label: "Profile updated" },
  { value: "stats_updated", label: "Stats updated" },
  { value: "photo_changed", label: "Photo changed" },
  { value: "photo_removed", label: "Photo removed" },
  { value: "document_uploaded", label: "Document uploaded" },
  { value: "document_deleted", label: "Document removed" },
  { value: "equipment_assigned", label: "Equipment assigned" },
  { value: "equipment_unassigned", label: "Equipment unassigned" },
]

function ActivityTab({ playerId, teamId }: { playerId: string; teamId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("")

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ teamId, limit: "50" })
    if (actionTypeFilter) params.set("actionType", actionTypeFilter)
    fetch(`/api/roster/${playerId}/activity?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ActivityItem[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [playerId, teamId, actionTypeFilter])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="activity-type-filter" className="text-sm text-[#64748B]">Filter:</label>
          <select
            id="activity-type-filter"
            value={actionTypeFilter}
            onChange={(e) => setActionTypeFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
          >
            {ACTIVITY_TYPE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-8 text-center">
          <History className="mx-auto h-10 w-10 text-[#94A3B8]" />
          <p className="mt-3 text-sm text-[#64748B]">No activity yet.</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {actionTypeFilter ? "No matching activity for this filter." : "Photo, profile, document, and equipment changes will appear here."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[#64748B]">Recent changes to this profile.</p>
        <div className="flex items-center gap-2">
          <label htmlFor="activity-type-filter-filled" className="text-sm text-[#64748B]">Filter:</label>
          <select
            id="activity-type-filter-filled"
            value={actionTypeFilter}
            onChange={(e) => setActionTypeFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
          >
            {ACTIVITY_TYPE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <ul className="divide-y divide-[#E5E7EB] rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <span className="font-medium text-[#0F172A]">
                {ACTIVITY_LABELS[a.actionType] ?? a.actionType}
              </span>
              {a.metadata?.title != null && (
                <span className="ml-2 text-sm text-[#64748B]">— {String(a.metadata.title)}</span>
              )}
              {a.metadata?.itemName != null && (
                <span className="ml-2 text-sm text-[#64748B]">— {String(a.metadata.itemName)}</span>
              )}
              {a.actor?.name && (
                <p className="mt-0.5 text-xs text-[#94A3B8]">by {a.actor.name}</p>
              )}
            </div>
            <span className="text-xs text-[#94A3B8] shrink-0">{formatActivityTime(a.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NotesTab({
  profile,
  canEdit,
  editDraft,
  setEditDraft,
  value,
}: {
  profile: PlayerProfile
  canEdit: boolean
  editDraft: Partial<PlayerProfile>
  setEditDraft: (d: Partial<PlayerProfile> | ((prev: Partial<PlayerProfile>) => Partial<PlayerProfile>)) => void
  value: (k: keyof PlayerProfile) => unknown
}) {
  const notesText = profile.notes ?? profile.profileNotes ?? ""
  const hasNotes = !!notesText.trim()
  const hasTags = Array.isArray(profile.tags) && profile.tags.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-[#64748B]">Notes</Label>
        {canEdit ? (
          <textarea
            className="min-h-[120px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A]"
            value={String(value("notes") ?? value("profileNotes") ?? "")}
            onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value || null, profileNotes: e.target.value || null }))}
            placeholder="General notes..."
          />
        ) : hasNotes ? (
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <p className="whitespace-pre-wrap break-words text-sm text-[#0F172A]">{notesText}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-6 text-center">
            <p className="text-sm text-[#64748B]">No notes yet.</p>
          </div>
        )}
      </div>
      {hasTags && (
        <div className="space-y-2">
          <Label className="text-[#64748B]">Tags</Label>
          <div className="flex flex-wrap gap-2">
            {profile.tags!.map((t) => (
              <span key={t} className="rounded-full bg-[#E2E8F0] px-3 py-1 text-xs text-[#475569]">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
