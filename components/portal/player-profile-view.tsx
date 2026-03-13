"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, User, BarChart3, Package, FileText, Save, Loader2 } from "lucide-react"
import type { PlayerProfile } from "@/types/player-profile"

type TabId = "overview" | "info" | "stats" | "equipment" | "notes"

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "info", label: "Info", icon: User },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "equipment", label: "Equipment", icon: Package },
  { id: "notes", label: "Notes", icon: FileText },
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save")
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
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

  const hasEdits = Object.keys(editDraft).length > 0
  const value = (key: keyof PlayerProfile) => (editDraft[key] !== undefined ? editDraft[key] : (profile as Record<string, unknown>)[key as string])

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 rounded-lg border border-[rgb(var(--border))] overflow-hidden bg-[rgb(var(--platinum))] flex items-center justify-center">
              {profile.imageUrl && profile.imageUrl.trim() ? (
                <Image src={profile.imageUrl} alt="" fill className="object-cover" unoptimized sizes="56px" />
              ) : (
                <span className="text-lg font-semibold" style={{ color: "rgb(var(--muted))" }}>
                  {(profile.firstName?.[0] ?? "") + (profile.lastName?.[0] ?? "") || "?"}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#0F172A]">{getDisplayName()}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#64748B]">
                {profile.jerseyNumber != null && <span className="font-medium">#{profile.jerseyNumber}</span>}
                {profile.position && <span>{profile.position}</span>}
                {profile.teamName && <span>{profile.teamName}</span>}
                <span className={`rounded border px-2 py-0.5 text-xs font-medium ${getStatusColor()}`}>
                  {profile.healthStatus === "injured" ? "Injured" : profile.activeStatus === "inactive" ? "Inactive" : "Active"}
                </span>
              </div>
            </div>
          </div>
        </div>
        {canEditProfile && hasEdits && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-2">{saving ? "Saving..." : "Save"}</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB]">
        <nav className="flex gap-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-2 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[#0B2A5B] text-[#0F172A]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
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
            <OverviewTab profile={profile} canEdit={canEditProfile} editDraft={editDraft} setEditDraft={setEditDraft} value={value} />
          )}
          {activeTab === "info" && (
            <InfoTab profile={profile} canEdit={canEditProfile} editDraft={editDraft} setEditDraft={setEditDraft} value={value} />
          )}
          {activeTab === "stats" && (
            <StatsTab profile={profile} canEdit={canEditProfile} editDraft={editDraft} setEditDraft={setEditDraft} value={value} />
          )}
          {activeTab === "equipment" && (
            <EquipmentTab profile={profile} canEdit={canEditProfile} />
          )}
          {activeTab === "notes" && (
            <NotesTab profile={profile} canEdit={canEditProfile} editDraft={editDraft} setEditDraft={setEditDraft} value={value} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function OverviewTab({
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
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-2">
        <Label className="text-[#64748B]">Name</Label>
        <p className="text-[#0F172A]">
          {profile.firstName} {profile.lastName}
          {profile.preferredName && <span className="text-[#64748B]"> ({profile.preferredName})</span>}
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-[#64748B]">Jersey #</Label>
        <p className="text-[#0F172A]">{profile.jerseyNumber ?? "—"}</p>
      </div>
      <div className="space-y-2">
        <Label className="text-[#64748B]">Position</Label>
        <p className="text-[#0F172A]">{profile.position ?? "—"}</p>
      </div>
      <div className="space-y-2">
        <Label className="text-[#64748B]">Team</Label>
        <p className="text-[#0F172A]">{profile.teamName ?? "—"}</p>
      </div>
      <div className="space-y-2">
        <Label className="text-[#64748B]">Status</Label>
        <p className="text-[#0F172A]">
          {profile.healthStatus === "injured" ? "Injured" : profile.activeStatus === "inactive" ? "Inactive" : "Active"}
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-[#64748B]">Email</Label>
        {canEdit ? (
          <Input
            type="email"
            value={String(value("playerEmail") ?? "")}
            onChange={(e) => setEditDraft((p) => ({ ...p, playerEmail: e.target.value || null }))}
            placeholder="Player email"
            className="max-w-sm"
          />
        ) : (
          <p className="text-[#0F172A]">{profile.playerEmail ?? "—"}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-[#64748B]">Phone</Label>
        {canEdit ? (
          <Input
            value={String(value("playerPhone") ?? "")}
            onChange={(e) => setEditDraft((p) => ({ ...p, playerPhone: e.target.value || null }))}
            placeholder="Player phone"
            className="max-w-sm"
          />
        ) : (
          <p className="text-[#0F172A]">{profile.playerPhone ?? "—"}</p>
        )}
      </div>
    </div>
  )
}

function InfoTab({
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
              <p className="text-[#0F172A]">{(profile as Record<string, unknown>)[key as string] ?? "—"}</p>
            )}
          </div>
        ))}
      </div>
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
  const seasonKeys = profile.seasonStats && typeof profile.seasonStats === "object" ? Object.keys(profile.seasonStats as Record<string, unknown>) : []
  const hasStats = seasonKeys.length > 0 || (Array.isArray(profile.gameStats) && profile.gameStats.length > 0)
  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="space-y-2">
          <Label className="text-[#64748B]">Coach notes on performance</Label>
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A]"
            value={String(value("coachNotes") ?? "")}
            onChange={(e) => setEditDraft((p) => ({ ...p, coachNotes: e.target.value || null }))}
            placeholder="Notes on performance..."
          />
        </div>
      )}
      {!canEdit && profile.coachNotes && (
        <div className="space-y-2">
          <Label className="text-[#64748B]">Coach notes</Label>
          <p className="text-[#0F172A] whitespace-pre-wrap">{profile.coachNotes}</p>
        </div>
      )}
      {hasStats ? (
        <div className="space-y-4">
          {seasonKeys.length > 0 && (
            <div>
              <Label className="text-[#64748B]">Season stats</Label>
              <pre className="mt-2 rounded bg-[#F8FAFC] p-4 text-sm text-[#0F172A] overflow-x-auto">
                {JSON.stringify(profile.seasonStats, null, 2)}
              </pre>
            </div>
          )}
          {Array.isArray(profile.gameStats) && profile.gameStats.length > 0 && (
            <div>
              <Label className="text-[#64748B]">Game stats</Label>
              <pre className="mt-2 rounded bg-[#F8FAFC] p-4 text-sm text-[#0F172A] overflow-x-auto">
                {JSON.stringify(profile.gameStats, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[#64748B]">No stats recorded yet.</p>
      )}
    </div>
  )
}

function EquipmentTab({ profile, canEdit }: { profile: PlayerProfile; canEdit: boolean }) {
  const items = profile.assignedItems ?? []
  return (
    <div className="space-y-4">
      {profile.equipmentIssueReturnNotes && (
        <div className="space-y-2">
          <Label className="text-[#64748B]">Issue / Return notes</Label>
          <p className="text-[#0F172A] whitespace-pre-wrap">{profile.equipmentIssueReturnNotes}</p>
        </div>
      )}
      {items.length > 0 ? (
        <ul className="divide-y divide-[#E5E7EB]">
          {items.map((i) => (
            <li key={i.id ?? i.name} className="py-2 flex justify-between items-center">
              <span className="font-medium text-[#0F172A]">{i.name}</span>
              <span className="text-sm text-[#64748B]">{i.category ?? ""} · {i.condition ?? ""}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#64748B]">No equipment assigned.</p>
      )}
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
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-[#64748B]">Notes</Label>
        {canEdit ? (
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A]"
            value={String(value("notes") ?? value("profileNotes") ?? "")}
            onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value || null, profileNotes: e.target.value || null }))}
            placeholder="General notes..."
          />
        ) : (
          <p className="text-[#0F172A] whitespace-pre-wrap">{profile.notes ?? profile.profileNotes ?? "—"}</p>
        )}
      </div>
      {Array.isArray(profile.tags) && profile.tags.length > 0 && (
        <div className="space-y-2">
          <Label className="text-[#64748B]">Tags</Label>
          <div className="flex flex-wrap gap-2">
            {profile.tags.map((t) => (
              <span key={t} className="rounded-full bg-[#E2E8F0] px-3 py-1 text-xs text-[#475569]">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
