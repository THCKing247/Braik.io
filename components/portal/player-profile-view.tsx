"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, BarChart3, Package, FileText, Save, Loader2, User, Camera, Trash2, FileUp, ExternalLink, History, Eye, EyeOff, CheckCircle2, XCircle, Mail, Phone, ClipboardList, Copy, Dumbbell } from "lucide-react"
import type { PlayerProfile } from "@/types/player-profile"
import { PlayerProfileWeeklyStatsPanel } from "./player-profile-weekly-stats-panel"
import {
  SEASON_STAT_KEYS,
  SEASON_STAT_KEY_TO_PLAYER_ROW_FIELD,
  toPlayerStatsRow,
  type SeasonStatKey,
} from "@/lib/stats-helpers"
import { LEGACY_WEEKLY_STAT_KEYS, PROFILE_SEASON_GROUPS } from "@/lib/stats-schema"
import { labelForSeasonStatDbKey } from "@/lib/stats-season-labels"
import {
  buildVisibleDerivedCards,
  getPrimarySeasonStatKeysForGroup,
  getPrimaryPlayerRowStatKeysForGroup,
  getStatsViewForPosition,
} from "@/lib/stats-position-views"
import { PlayerPhotoCropModal } from "./player-photo-crop-modal"
import { PortalUnderlineTabs } from "./portal-underline-tabs"
import { DatePicker, dateToYmd, ymdToDate } from "@/components/portal/date-time-picker"
import { startOfDay } from "date-fns"
import { parseRosterLimitResponse } from "@/lib/roster/roster-limit-ui"
import {
  PLAYER_DOCUMENT_UPLOAD_HELPER,
  PLAYER_DOCUMENT_CONSENT_TEXT,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/player-documents/constants"
import { SmsConsentCheckbox } from "@/components/compliance/sms-consent-checkbox"
import { AddFollowUpModal } from "@/components/portal/add-follow-up-modal"
import { isPlayerAssignableBucket } from "@/lib/inventory-category-policy"
import { FOLLOW_UP_CATEGORY_LABELS } from "@/lib/roster/follow-up-ui"
import { getPositionByCode } from "@/lib/constants/playbook-positions"

type TabId = "overview" | "info" | "stats" | "equipment" | "documents" | "health" | "history"

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "info", label: "Info" },
  { id: "stats", label: "Stats" },
  { id: "equipment", label: "Equipment" },
  { id: "documents", label: "Documents" },
  { id: "health", label: "Health" },
  { id: "history", label: "History" },
]

function getProfileStatusDisplay(p: PlayerProfile): { label: string; chipClass: string } {
  const roster = (p.activeStatus ?? "active").toLowerCase()
  const health = (p.healthStatus ?? "active").toLowerCase()
  if (health === "injured") return { label: "Injured", chipClass: "bg-amber-100 text-amber-900 border-amber-200" }
  if (health === "unavailable") return { label: "Suspended", chipClass: "bg-orange-100 text-orange-900 border-orange-200" }
  if (roster === "suspended") return { label: "Suspended", chipClass: "bg-orange-100 text-orange-900 border-orange-200" }
  if (roster === "inactive") return { label: "Inactive", chipClass: "bg-red-100 text-red-900 border-red-200" }
  return { label: "Active", chipClass: "bg-green-100 text-green-900 border-green-200" }
}

/** Feet / inches → stored height string e.g. 5'10" */
const HEIGHT_FEET_OPTIONS = ["4", "5", "6", "7"]
const HEIGHT_INCH_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i))
/** Single-pound steps for structured weight (lbs). */
const WEIGHT_LB_OPTIONS = Array.from({ length: 281 }, (_, i) => 90 + i)

const CLASS_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "9", label: "Freshman" },
  { value: "10", label: "Sophomore" },
  { value: "11", label: "Junior" },
  { value: "12", label: "Senior" },
]

function schoolGradeToLabel(grade: number | null | undefined): string {
  if (grade === 9) return "Freshman"
  if (grade === 10) return "Sophomore"
  if (grade === 11) return "Junior"
  if (grade === 12) return "Senior"
  return "—"
}

function normalizePositionBaseCode(raw: string): string {
  const u = raw.trim().toUpperCase()
  const m = u.match(/^([A-Z]+)/)
  return m ? m[1] : u
}

function parseHeightParts(height: string | null | undefined): { ft: string; inch: string } {
  if (!height || typeof height !== "string") return { ft: "", inch: "" }
  const t = height.trim()
  const m = /^(\d)'(\d{1,2})"?$/.exec(t)
  if (m) {
    const inch = Math.min(11, Math.max(0, parseInt(m[2], 10)))
    return { ft: m[1], inch: String(Number.isFinite(inch) ? inch : 0) }
  }
  return { ft: "", inch: "" }
}

function formatHeightParts(ft: string, inch: string): string | null {
  if (!ft) return null
  const f = parseInt(ft, 10)
  const i = Math.min(11, Math.max(0, parseInt(inch || "0", 10)))
  if (!Number.isFinite(f) || f < 4 || f > 7) return null
  return `${f}'${i}"`
}

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
  const [isOwnProfileFromApi, setIsOwnProfileFromApi] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [saving, setSaving] = useState(false)
  const [editDraft, setEditDraft] = useState<Partial<PlayerProfile>>({})
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoRemoving, setPhotoRemoving] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null)
  const [cropFileName, setCropFileName] = useState<string>("photo.jpg")
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const [smsConsentOptIn, setSmsConsentOptIn] = useState(false)

  const hasEdits = Object.keys(editDraft).length > 0

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

  const validateImageFile = (file: File): string | null => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return "Invalid file type. Use JPEG, PNG, GIF, or WebP."
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return "File is too large. Maximum size is 5MB."
    }
    return null
  }

  const uploadPhotoFile = useCallback(
    async (file: File) => {
      if (!profile) return
      setPhotoError(null)
      const previewUrl = URL.createObjectURL(file)
      setPhotoPreviewUrl(previewUrl)
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
        setPhotoPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
      }
    },
    [playerId, profile]
  )

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setPhotoError(null)

    const validationError = validateImageFile(file)
    if (validationError) {
      setPhotoError(validationError)
      e.target.value = ""
      return
    }

    const url = URL.createObjectURL(file)
    setCropImageUrl(url)
    setCropFileName(file.name)
    setCropOpen(true)
    e.target.value = ""
  }

  const handleCropConfirm = useCallback(
    (blob: Blob) => {
      const file = new File([blob], cropFileName.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })
      setCropOpen(false)
      if (cropImageUrl) {
        URL.revokeObjectURL(cropImageUrl)
        setCropImageUrl(null)
      }
      uploadPhotoFile(file)
    },
    [cropFileName, cropImageUrl, uploadPhotoFile]
  )

  const handleCropCancel = useCallback(() => {
    setCropOpen(false)
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl)
      setCropImageUrl(null)
    }
  }, [cropImageUrl])

  const handlePhotoRemove = async () => {
    if (!profile || photoUploading || photoRemoving) return
    if (!confirm("Remove profile photo?")) return
    setPhotoError(null)
    setPhotoRemoving(true)
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
      setPhotoRemoving(false)
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
      .then((data: { profile: PlayerProfile; canEdit: boolean; isOwnProfile?: boolean } | undefined) => {
        if (data?.profile) {
          setProfile(data.profile)
          setCanEditProfile(data.canEdit)
          if (data.isOwnProfile !== undefined) setIsOwnProfileFromApi(!!data.isOwnProfile)
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
          setIsOwnProfileFromApi(!!data.isOwnProfile)
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

    if (editDraft.playerPhone !== undefined) {
      const next = String(editDraft.playerPhone ?? "").trim()
      if (next && !smsConsentOptIn) {
        setSaveMessage({
          type: "error",
          text: "To save a mobile number for SMS notifications, confirm the SMS consent box below (see Privacy Policy and Terms of Service).",
        })
        return
      }
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = { teamId }
      if (editDraft.preferredName !== undefined) body.preferredName = editDraft.preferredName
      if (editDraft.playerEmail !== undefined) body.playerEmail = editDraft.playerEmail
      if (editDraft.playerPhone !== undefined) {
        body.playerPhone = editDraft.playerPhone
        const next = String(editDraft.playerPhone ?? "").trim()
        if (next) body.smsTransactionalOptIn = smsConsentOptIn
      }
      if (editDraft.address !== undefined) body.address = editDraft.address
      if (editDraft.emergencyContact !== undefined) body.emergencyContact = editDraft.emergencyContact
      if (canEdit) {
        if (editDraft.firstName !== undefined) body.firstName = editDraft.firstName
        if (editDraft.lastName !== undefined) body.lastName = editDraft.lastName
        if (editDraft.jerseyNumber !== undefined) body.jerseyNumber = editDraft.jerseyNumber
        if (editDraft.position !== undefined) body.position = editDraft.position
        if (editDraft.secondaryPosition !== undefined) body.secondaryPosition = editDraft.secondaryPosition
        if (editDraft.graduationYear !== undefined) body.graduationYear = editDraft.graduationYear
        if (editDraft.schoolGrade !== undefined) body.schoolGrade = editDraft.schoolGrade
        if (editDraft.height !== undefined) body.height = editDraft.height
        if (editDraft.weight !== undefined) body.weight = editDraft.weight
        if (editDraft.dateOfBirth !== undefined) body.dateOfBirth = editDraft.dateOfBirth
        if (editDraft.school !== undefined) body.school = editDraft.school
        if (editDraft.parentGuardianContact !== undefined) body.parentGuardianContact = editDraft.parentGuardianContact
        if (editDraft.medicalNotes !== undefined) body.medicalNotes = editDraft.medicalNotes
        if (editDraft.medicalAlerts !== undefined) body.medicalAlerts = editDraft.medicalAlerts
        if (editDraft.emergencyContactRelationship !== undefined) {
          body.emergencyContactRelationship = editDraft.emergencyContactRelationship
        }
        if (editDraft.healthStatus !== undefined) body.healthStatus = editDraft.healthStatus
        if (editDraft.activeStatus !== undefined) body.activeStatus = editDraft.activeStatus
        if (editDraft.suspensionEndDate !== undefined) body.suspensionEndDate = editDraft.suspensionEndDate
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const r = parseRosterLimitResponse(data)
        throw new Error(r.message)
      }
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
    if (!profile) return "bg-green-100 text-green-900 border-green-200"
    return `${getProfileStatusDisplay(profile).chipClass} border`
  }

  const mergedPhoneForSms = useMemo(() => {
    if (!profile) return ""
    const d = editDraft.playerPhone
    if (d !== undefined) return String(d ?? "").trim()
    return profile.playerPhone?.trim() ?? ""
  }, [editDraft.playerPhone, profile])

  useEffect(() => {
    if (profile) setSmsConsentOptIn(profile.smsTransactionalOptIn ?? false)
  }, [profile?.id, profile?.smsTransactionalOptIn])

  useEffect(() => {
    if (!mergedPhoneForSms) setSmsConsentOptIn(false)
  }, [mergedPhoneForSms])

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
      {cropOpen && cropImageUrl && (
        <PlayerPhotoCropModal
          open={cropOpen}
          imageUrl={cropImageUrl}
          fileName={cropFileName}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      {/* Back + Header: polished summary card */}
      <Card className="overflow-hidden border-[rgb(var(--border))]">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Link href={backHref} className="shrink-0">
                <Button variant="ghost" size="icon" aria-label="Back to roster">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="relative shrink-0">
                <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--platinum))]">
                  {photoPreviewUrl ? (
                    <Image src={photoPreviewUrl} alt="" fill className="object-cover" unoptimized sizes="64px" />
                  ) : profile.imageUrl && profile.imageUrl.trim() ? (
                    <Image src={profile.imageUrl} alt="" fill className="object-cover" unoptimized sizes="64px" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xl font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      {(profile.firstName?.[0] ?? "") + (profile.lastName?.[0] ?? "") || "?"}
                    </span>
                  )}
                  {(photoUploading || photoRemoving) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
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
                      disabled={photoUploading || photoRemoving}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={photoUploading || photoRemoving}
                    >
                      {photoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      <span className="ml-1">{photoUploading ? "Uploading…" : "Change photo"}</span>
                    </Button>
                    {profile.imageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={handlePhotoRemove}
                        disabled={photoUploading || photoRemoving}
                      >
                        {photoRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        <span className="ml-1">{photoRemoving ? "Removing…" : "Remove"}</span>
                      </Button>
                    )}
                    {photoError && (
                      <p className="text-xs text-red-600" role="alert">{photoError}</p>
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
                    <span className="text-[#64748B] font-normal">Status: </span>
                    {getProfileStatusDisplay(profile).label}
                  </span>
                  {profile.eligibilityStatus?.trim() && (
                    <span className="rounded border border-[#E5E7EB] bg-white px-2 py-0.5 text-xs font-medium text-[#0F172A]">
                      <span className="text-[#64748B] font-normal">Eligibility: </span>
                      {profile.eligibilityStatus.trim()}
                    </span>
                  )}
                </div>
              </div>
            </div>
              <ProfileNotesCard
                profile={profile}
                canEdit={canEditProfile}
                editDraft={editDraft}
                setEditDraft={setEditDraft}
                value={value}
              />
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:pt-0">
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
      <PortalUnderlineTabs
        tabs={TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
        value={activeTab}
        onValueChange={(id) => setActiveTab(id as TabId)}
        ariaLabel="Profile sections"
      />

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
            <StatsTab
              playerId={playerId}
              teamId={teamId}
              profile={profile}
              canManageWeeklyStats={false}
              onProfileRefetch={refetchProfile}
            />
          )}
          {activeTab === "equipment" && (
            <EquipmentTab
              profile={profile}
              teamId={teamId}
              playerId={playerId}
              canEdit={canEditProfile}
              isOwnProfile={isOwnProfile || isOwnProfileFromApi}
              onProfileRefetch={refetchProfile}
            />
          )}
          {activeTab === "documents" && (
            <DocumentsTab playerId={playerId} teamId={teamId} />
          )}
          {activeTab === "health" && (
            <HealthTab
              playerId={playerId}
              teamId={teamId}
              profile={profile}
              canEditMedical={canEdit}
              setEditDraft={setEditDraft}
              value={value}
              onProfileRefetch={refetchProfile}
            />
          )}
          {activeTab === "history" && (
            <HistoryTab playerId={playerId} teamId={teamId} />
          )}

          {canEditProfile && (activeTab === "overview" || activeTab === "info" || activeTab === "health") && mergedPhoneForSms.length > 0 && (
            <div className="mt-6 border-t border-[#E5E7EB] pt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Transactional SMS</p>
              <SmsConsentCheckbox
                id={`player-profile-sms-${playerId}`}
                checked={smsConsentOptIn}
                onChange={setSmsConsentOptIn}
                disabled={saving}
              />
            </div>
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
  scheduledStart?: string | null
  scheduledEnd?: string | null
}

function FollowUpsSection({
  playerId,
  teamId,
  canEdit,
  playerDisplayName,
}: {
  playerId: string
  teamId: string
  canEdit: boolean
  playerDisplayName: string
}) {
  const [list, setList] = useState<FollowUpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false)
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
                    {f.scheduledStart && (
                      <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                        Scheduled:{" "}
                        {new Date(f.scheduledStart).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    )}
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
              <Button type="button" variant="outline" size="sm" onClick={() => setFollowUpModalOpen(true)}>
                Add follow-up
              </Button>
              <AddFollowUpModal
                open={followUpModalOpen}
                onOpenChange={setFollowUpModalOpen}
                playerId={playerId}
                teamId={teamId}
                playerDisplayName={playerDisplayName}
                onSuccess={() => void load()}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProfileNotesCard({
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
    <div className="w-full min-w-0 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 lg:max-w-sm lg:shrink-0">
      <Label className="text-xs font-medium text-[#64748B]">Notes</Label>
      {canEdit ? (
        <textarea
          className="mt-1.5 min-h-[72px] w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm text-[#0F172A]"
          value={String(value("notes") ?? value("profileNotes") ?? "")}
          onChange={(e) =>
            setEditDraft((p) => ({ ...p, notes: e.target.value || null, profileNotes: e.target.value || null }))
          }
          placeholder="General notes…"
        />
      ) : hasNotes ? (
        <div className="mt-1.5 rounded-md border border-[#E5E7EB] bg-white p-2">
          <p className="whitespace-pre-wrap break-words text-sm text-[#0F172A]">{notesText}</p>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-[#94A3B8]">No notes yet.</p>
      )}
      {hasTags && (
        <div className="mt-2 space-y-1">
          <span className="text-xs font-medium text-[#64748B]">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {profile.tags!.map((t) => (
              <span key={t} className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-xs text-[#475569]">{t}</span>
            ))}
          </div>
        </div>
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
  const statusDisplay = getProfileStatusDisplay(profile)
  return (
    <div className="space-y-6">
      {/* Readiness / compliance + contact — tighter pairing on large screens */}
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-4 lg:space-y-0">
      {readiness && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm lg:p-3">
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

      {/* Contact card */}
      <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 lg:p-3">
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
      </div>

      {/* Weight room maxes (read-only; logged in Weight Room module) */}
      {(profile.weightRoomMaxes &&
        (profile.weightRoomMaxes.benchLbs != null ||
          profile.weightRoomMaxes.squatLbs != null ||
          profile.weightRoomMaxes.cleanLbs != null ||
          profile.weightRoomMaxes.deadliftLbs != null)) ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            <Dumbbell className="h-4 w-4" aria-hidden />
            Weight room — current maxes (lbs)
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Bench", v: profile.weightRoomMaxes.benchLbs },
              { label: "Squat", v: profile.weightRoomMaxes.squatLbs },
              { label: "Power clean", v: profile.weightRoomMaxes.cleanLbs },
              { label: "Deadlift", v: profile.weightRoomMaxes.deadliftLbs },
            ].map(({ label, v }) => (
              <div key={label} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
                <p className="text-[11px] font-medium uppercase text-[#64748B]">{label}</p>
                <p className="text-lg font-semibold tabular-nums text-[#0F172A]">{v != null ? v : "—"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Follow-ups (coach intervention tracking) */}
      <FollowUpsSection
        playerId={playerId}
        teamId={teamId}
        canEdit={canEdit}
        playerDisplayName={`${String(profile.firstName ?? "").trim()} ${String(profile.lastName ?? "").trim()}`.trim() || "Player"}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
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
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Personal player code</Label>
          <p className="text-xs text-[#94A3B8] -mt-0.5">For parent signup — enter at Parent sign up.</p>
          <div className="flex items-center gap-2">
            <p className={`${readOnlyClass} flex-1 font-mono`}>{profile.inviteCode?.trim() || "—"}</p>
            {profile.inviteCode?.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Copy personal player code"
                onClick={() => void navigator.clipboard.writeText(profile.inviteCode!.trim())}
              >
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Team parent code</Label>
          <p className="text-xs text-[#94A3B8] -mt-0.5">Optional team-wide code (if your program uses it).</p>
          <div className="flex items-center gap-2">
            <p className={`${readOnlyClass} flex-1 font-mono`}>{profile.parentCode?.trim() || "—"}</p>
            {profile.parentCode?.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Copy team parent code"
                onClick={() => void navigator.clipboard.writeText(profile.parentCode!.trim())}
              >
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Player status</Label>
          <p className={`rounded-lg border px-3 py-2 text-sm font-medium ${statusDisplay.chipClass}`}>
            {statusDisplay.label}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Eligibility</Label>
          <p className={readOnlyClass}>{profile.eligibilityStatus?.trim() || "—"}</p>
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
  const dateOfBirthValue = ((): Date | null => {
    const v = value("dateOfBirth")
    if (v == null || v === "") return null
    const s = String(v).trim()
    if (s.length >= 10) {
      const d = ymdToDate(s.slice(0, 10))
      if (d) return d
    }
    const parsed = new Date(s)
    return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed)
  })()

  const gradYearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 8 }, (_, i) => y - 2 + i)
  }, [])

  const positionDraft = String(value("position") ?? "").trim()
  const positionBase = positionDraft ? normalizePositionBaseCode(positionDraft) : ""
  const positionWarning =
    canEdit && positionDraft && !getPositionByCode(positionBase)
      ? `"${positionDraft}" is not a standard position code. Use codes like QB, WR, or MLB so depth charts and stats stay aligned.`
      : canEdit && !positionDraft
        ? "Add a standard position (e.g. QB, WR, CB) for formations and stat views."
        : null

  const secondaryDraft = String(value("secondaryPosition") ?? "").trim()
  const secondaryBase = secondaryDraft ? normalizePositionBaseCode(secondaryDraft) : ""
  const secondaryWarning =
    canEdit && secondaryDraft && !getPositionByCode(secondaryBase)
      ? `Secondary "${secondaryDraft}" is not a standard position code; use the same letter codes as primary (e.g. WR, CB).`
      : null

  const gradYearNum = (() => {
    const gy = value("graduationYear")
    if (gy == null || gy === "") return null
    const n = Number(gy)
    return Number.isFinite(n) ? n : null
  })()
  const nowYear = new Date().getFullYear()
  const gradYearWarning =
    canEdit && gradYearNum != null && (gradYearNum < nowYear - 10 || gradYearNum > nowYear + 10)
      ? "Graduation year looks unusual; confirm it matches school records."
      : null

  const heightMerged = String(value("height") ?? "")
  const heightParts = useMemo(() => parseHeightParts(heightMerged), [heightMerged])

  const readOnlyBox = "min-h-[2.5rem] rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A]"

  const simpleFields: { key: keyof PlayerProfile; label: string }[] = [
    { key: "firstName", label: "First name" },
    { key: "lastName", label: "Last name" },
    { key: "preferredName", label: "Preferred name / Nickname" },
    { key: "jerseyNumber", label: "Jersey number" },
    { key: "school", label: "School" },
    { key: "parentGuardianContact", label: "Parent/Guardian contact" },
    { key: "playerEmail", label: "Player email" },
    { key: "playerPhone", label: "Player phone" },
    { key: "address", label: "Address" },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {simpleFields.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <Label className="text-[#64748B]">{label}</Label>
            {canEdit ? (
              key === "jerseyNumber" ? (
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
              <p className={readOnlyBox}>
                {(profile as unknown as Record<string, unknown>)[key as string] != null && (profile as unknown as Record<string, unknown>)[key as string] !== ""
                  ? String((profile as unknown as Record<string, unknown>)[key as string])
                  : "—"}
              </p>
            )}
          </div>
        ))}

        <div className="space-y-2 sm:col-span-2">
          <Label className="text-[#64748B]">Position</Label>
          {canEdit ? (
            <Input
              value={String(value("position") ?? "")}
              onChange={(e) => setEditDraft((p) => ({ ...p, position: e.target.value || null }))}
              placeholder="e.g. QB, WR1, MLB"
            />
          ) : (
            <p className={readOnlyBox}>{profile.position ?? "—"}</p>
          )}
          {positionWarning && <p className="text-xs text-amber-800">{positionWarning}</p>}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label className="text-[#64748B]">Secondary position</Label>
          {canEdit ? (
            <Input
              value={String(value("secondaryPosition") ?? "")}
              onChange={(e) => setEditDraft((p) => ({ ...p, secondaryPosition: e.target.value || null }))}
              placeholder="e.g. WR, CB (optional)"
            />
          ) : (
            <p className={readOnlyBox}>{profile.secondaryPosition ?? "—"}</p>
          )}
          {secondaryWarning && <p className="text-xs text-amber-800">{secondaryWarning}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-[#64748B]">Class</Label>
          {canEdit ? (
            <select
              className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
              value={value("schoolGrade") != null && value("schoolGrade") !== "" ? String(value("schoolGrade")) : ""}
              onChange={(e) =>
                setEditDraft((p) => ({
                  ...p,
                  schoolGrade: e.target.value ? Number(e.target.value) : null,
                }))
              }
            >
              {CLASS_SELECT_OPTIONS.map((o) => (
                <option key={o.value || "empty"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <p className={readOnlyBox}>{schoolGradeToLabel(profile.schoolGrade ?? null)}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-[#64748B]">Graduation year</Label>
          {canEdit ? (
            <select
              className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
              value={value("graduationYear") != null && value("graduationYear") !== "" ? String(value("graduationYear")) : ""}
              onChange={(e) =>
                setEditDraft((p) => ({
                  ...p,
                  graduationYear: e.target.value ? Number(e.target.value) : null,
                }))
              }
            >
              <option value="">—</option>
              {gradYearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          ) : (
            <p className={readOnlyBox}>{profile.graduationYear ?? "—"}</p>
          )}
          {gradYearWarning && <p className="text-xs text-amber-800">{gradYearWarning}</p>}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label className="text-[#64748B]">Height</Label>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] min-w-[4.5rem]"
                aria-label="Feet"
                value={heightParts.ft || ""}
                onChange={(e) => {
                  const nf = e.target.value
                  const ni = heightParts.inch || "0"
                  setEditDraft((p) => ({ ...p, height: nf ? formatHeightParts(nf, ni) : null }))
                }}
              >
                <option value="">—</option>
                {HEIGHT_FEET_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <span className="text-sm text-[#64748B]">ft</span>
              <select
                className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] min-w-[4rem]"
                aria-label="Inches"
                value={heightParts.ft ? heightParts.inch || "0" : ""}
                disabled={!heightParts.ft}
                onChange={(e) => {
                  const ni = e.target.value
                  const nf = heightParts.ft || "5"
                  setEditDraft((p) => ({ ...p, height: formatHeightParts(nf, ni) }))
                }}
              >
                <option value="">—</option>
                {HEIGHT_INCH_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              <span className="text-sm text-[#64748B]">in</span>
            </div>
          ) : (
            <p className={readOnlyBox}>{profile.height ?? "—"}</p>
          )}
          {canEdit && heightMerged && !parseHeightParts(heightMerged).ft && (
            <p className="text-xs text-amber-800">
              Stored height does not match ft/in format; choose feet and inches to replace it (e.g. 5 ft 10 in).
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-[#64748B]">Weight (lbs)</Label>
          {canEdit ? (
            <select
              className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
              value={(() => {
                const w = value("weight")
                if (w == null || w === "") return ""
                const n = Number(w)
                return WEIGHT_LB_OPTIONS.includes(n) ? String(n) : "__current__"
              })()}
              onChange={(e) => {
                const v = e.target.value
                if (v === "__current__") return
                setEditDraft((p) => ({
                  ...p,
                  weight: v ? Number(v) : null,
                }))
              }}
            >
              <option value="">—</option>
              {(() => {
                const w = value("weight")
                const n = w != null && w !== "" ? Number(w) : NaN
                const showCurrent = Number.isFinite(n) && !WEIGHT_LB_OPTIONS.includes(n)
                return (
                  <>
                    {showCurrent && (
                      <option value="__current__">{n} lbs (current)</option>
                    )}
                    {WEIGHT_LB_OPTIONS.map((opt) => (
                      <option key={opt} value={String(opt)}>
                        {opt} lbs
                      </option>
                    ))}
                  </>
                )
              })()}
            </select>
          ) : (
            <p className={readOnlyBox}>{profile.weight != null ? `${profile.weight} lbs` : "—"}</p>
          )}
          {canEdit && profile.weight != null && !WEIGHT_LB_OPTIONS.includes(Number(profile.weight)) && (
            <p className="text-xs text-amber-800">Pick the nearest weight (lb) from the list to update the stored value.</p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label className="text-[#64748B]">Date of birth</Label>
          {canEdit ? (
            <DatePicker
              id={`profile-dob-${playerId}`}
              label=""
              value={dateOfBirthValue}
              onChange={(d) => setEditDraft((p) => ({ ...p, dateOfBirth: d ? dateToYmd(d) : null }))}
              placeholder="Select date of birth"
              minDate={new Date(new Date().getFullYear() - 120, 0, 1)}
              maxDate={new Date()}
              birthdateNav
              allowClear
            />
          ) : (
            <p className={readOnlyBox}>{profile.dateOfBirth ?? "—"}</p>
          )}
        </div>
      </div>
      <LinkedGuardiansSection playerId={playerId} teamId={teamId} />
    </div>
  )
}

const SYNCED_SEASON_STAT_KEYS = new Set<string>(SEASON_STAT_KEYS as unknown as string[])
const LEGACY_SEASON_JSON_KEYS = new Set<string>(LEGACY_WEEKLY_STAT_KEYS as unknown as string[])

function StatsTab({
  playerId,
  teamId,
  profile,
  canManageWeeklyStats,
  onProfileRefetch,
}: {
  playerId: string
  teamId: string
  profile: PlayerProfile
  canManageWeeklyStats: boolean
  onProfileRefetch: () => void
}) {
  const [seasonTotalsMode, setSeasonTotalsMode] = useState<"overview" | "all">("overview")

  const seasonStats =
    profile.seasonStats && typeof profile.seasonStats === "object" ? (profile.seasonStats as Record<string, unknown>) : {}

  const customSeasonEntries = Object.entries(seasonStats).filter(
    ([k, v]) =>
      !SYNCED_SEASON_STAT_KEYS.has(k) && !LEGACY_SEASON_JSON_KEYS.has(k) && v != null && v !== ""
  )

  const summaryRow = toPlayerStatsRow({
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    jerseyNumber: profile.jerseyNumber ?? null,
    positionGroup: profile.position ?? null,
    seasonStats,
  })

  const positionViewGroup = getStatsViewForPosition(profile.position ?? null).group
  const overviewSeasonKeySet = useMemo(
    () => new Set(getPrimarySeasonStatKeysForGroup(positionViewGroup)),
    [positionViewGroup]
  )
  const derivedSummaryCards = useMemo(
    () => buildVisibleDerivedCards(summaryRow, positionViewGroup),
    [summaryRow, positionViewGroup]
  )
  const weeklyVisibleStatKeys = useMemo(
    () => getPrimaryPlayerRowStatKeysForGroup(positionViewGroup).filter((k) => k !== "lastName"),
    [positionViewGroup]
  )

  const hasAnySyncedValue = (SEASON_STAT_KEYS as readonly SeasonStatKey[]).some((k) => {
    const field = SEASON_STAT_KEY_TO_PLAYER_ROW_FIELD[k]
    const v = summaryRow[field] as number | null
    return v !== null && v !== undefined
  })
  const hasSeasonDisplay = hasAnySyncedValue || customSeasonEntries.length > 0

  const renderSeasonGroups = (mode: "overview" | "all") =>
    PROFILE_SEASON_GROUPS.map(({ label, keys }) => {
      const keysFiltered =
        mode === "overview" ? keys.filter((k) => overviewSeasonKeySet.has(k)) : [...keys]
      const rows = keysFiltered
        .map((k) => {
          const field = SEASON_STAT_KEY_TO_PLAYER_ROW_FIELD[k]
          const n = summaryRow[field] as number | null
          if (n === null || n === undefined) return null
          return (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-sm text-[#64748B]">{labelForSeasonStatDbKey(k)}</dt>
              <dd className="text-sm font-medium text-[#0F172A]">{String(n)}</dd>
            </div>
          )
        })
        .filter(Boolean)
      if (rows.length === 0) return null
      return (
        <div key={label} className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
          <dl className="space-y-1.5">{rows}</dl>
        </div>
      )
    })

  return (
    <div className="space-y-8">
      <div>
        <Label className="text-[#0F172A] font-medium">Season summary</Label>
        <p className="mt-1 text-xs text-[#64748B]">
          Read-only totals from Stats / Analytics (weekly and game lines). Totals are not edited on this tab.
        </p>
        {positionViewGroup === "OL" && seasonTotalsMode === "overview" && (
          <p className="mt-2 text-xs text-[#64748B]">
            Linemen: overview shows games played. Use <span className="font-medium text-[#0F172A]">All stats</span> for
            any other tracked fields.
          </p>
        )}
        {hasSeasonDisplay && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={seasonTotalsMode === "overview" ? "default" : "outline"}
              className={seasonTotalsMode === "overview" ? "" : "border-[#E5E7EB] bg-white"}
              onClick={() => setSeasonTotalsMode("overview")}
            >
              Overview
            </Button>
            <Button
              type="button"
              size="sm"
              variant={seasonTotalsMode === "all" ? "default" : "outline"}
              className={seasonTotalsMode === "all" ? "" : "border-[#E5E7EB] bg-white"}
              onClick={() => setSeasonTotalsMode("all")}
            >
              All stats
            </Button>
          </div>
        )}
        {hasSeasonDisplay ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {renderSeasonGroups(seasonTotalsMode)}
            {customSeasonEntries.length > 0 && (
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 sm:col-span-2 lg:col-span-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Custom season fields</p>
                <dl className="flex flex-wrap gap-x-4 gap-y-1">
                  {customSeasonEntries.map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-sm text-[#64748B]">{labelForSeasonStatDbKey(k)}:</dt>
                      <dd className="text-sm text-[#0F172A]">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-6 text-center">
            <p className="text-sm text-[#64748B]">No season totals yet.</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Totals populate when stat lines exist in your team&apos;s Stats / Analytics workflow.
            </p>
          </div>
        )}
      </div>

      {derivedSummaryCards.length > 0 && (
        <div className="border-t border-[#E5E7EB] pt-8">
          <Label className="text-[#0F172A] font-medium">Key rates</Label>
          <p className="mt-1 text-xs text-[#64748B]">Derived from season totals (read-only).</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {derivedSummaryCards.map((c, i) => (
              <div
                key={`${c.label}-${i}`}
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{c.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[#0F172A]">{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-[#E5E7EB] pt-8">
        <PlayerProfileWeeklyStatsPanel
          teamId={teamId}
          playerId={playerId}
          profile={profile}
          canManage={canManageWeeklyStats}
          onAfterMutation={onProfileRefetch}
          visibleStatColumnKeys={weeklyVisibleStatKeys}
        />
      </div>

      {profile.coachNotes && (
        <div className="space-y-2 border-t border-[#E5E7EB] pt-8">
          <Label className="text-[#64748B]">Coach notes</Label>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <p className="whitespace-pre-wrap break-words text-sm text-[#0F172A]">{profile.coachNotes}</p>
          </div>
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
  status?: string
  condition?: string
  size?: string | null
  equipmentType?: string | null
  /** Aligns with team inventory buckets (Gear, Uniforms, …). */
  inventoryBucket?: string
  assignedPlayer?: { id: string; firstName: string; lastName: string } | null
}

function normalizeInventoryBucket(i: InventoryItem): string {
  const raw = i.inventoryBucket?.trim()
  if (raw) return raw
  return "Gear"
}

function equipmentTypeLabel(i: InventoryItem): string {
  const t = (i.equipmentType || i.category || "").trim()
  return t || "Other"
}

function isAssignableInventoryItem(i: InventoryItem): boolean {
  if (!isPlayerAssignableBucket(normalizeInventoryBucket(i))) return false
  if (i.assignedToPlayerId) return false
  if ((i.quantityAvailable ?? 0) <= 0) return false
  const st = (i.status ?? "").toUpperCase()
  if (st === "RETIRED" || st === "DISPOSED" || st === "LOST" || st === "DAMAGED_BEYOND_USE") return false
  return true
}

function EquipmentTab({
  profile,
  teamId,
  playerId,
  canEdit,
  isOwnProfile,
  onProfileRefetch,
}: {
  profile: PlayerProfile
  teamId: string
  playerId: string
  canEdit: boolean
  isOwnProfile: boolean
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
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignBucket, setAssignBucket] = useState("")
  const [assignEquipmentType, setAssignEquipmentType] = useState("")
  const [assignSelectedItemId, setAssignSelectedItemId] = useState("")
  const [equipmentError, setEquipmentError] = useState<string | null>(null)
  const [equipmentActivity, setEquipmentActivity] = useState<{ id: string; actionType: string; metadata: Record<string, unknown>; createdAt: string }[]>([])
  const [damageDraft, setDamageDraft] = useState<Record<string, string>>({})
  const [damageSubmitting, setDamageSubmitting] = useState<string | null>(null)

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

  const availableToAssign = useMemo(
    () => inventoryList.filter(isAssignableInventoryItem),
    [inventoryList]
  )
  const assignedToThisPlayer = inventoryList.filter((i) => i.assignedToPlayerId === playerId)

  const assignBucketOptions = useMemo(() => {
    const set = new Set<string>()
    for (const i of availableToAssign) {
      set.add(normalizeInventoryBucket(i))
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [availableToAssign])

  const assignTypeOptionsInBucket = useMemo(() => {
    if (!assignBucket.trim()) return []
    const set = new Set<string>()
    for (const i of availableToAssign) {
      if (normalizeInventoryBucket(i) === assignBucket) {
        set.add(equipmentTypeLabel(i))
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [availableToAssign, assignBucket])

  const itemsForAssignSelection = useMemo(() => {
    if (!assignBucket.trim() || !assignEquipmentType.trim()) return []
    return availableToAssign
      .filter(
        (i) =>
          normalizeInventoryBucket(i) === assignBucket &&
          equipmentTypeLabel(i) === assignEquipmentType
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [availableToAssign, assignBucket, assignEquipmentType])

  const openAssignModal = () => {
    setEquipmentError(null)
    setAssignBucket("")
    setAssignEquipmentType("")
    setAssignSelectedItemId("")
    setAssignModalOpen(true)
  }

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
      setAssignModalOpen(false)
      setAssignBucket("")
      setAssignEquipmentType("")
      setAssignSelectedItemId("")
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
          <div className="mt-3">
            <Button type="button" size="sm" onClick={openAssignModal}>
              <Package className="h-4 w-4" />
              <span className="ml-2">Assign equipment…</span>
            </Button>
          </div>
          <Dialog
            open={assignModalOpen}
            onOpenChange={(o) => {
              setAssignModalOpen(o)
              if (!o) {
                setAssignBucket("")
                setAssignEquipmentType("")
                setAssignSelectedItemId("")
              }
            }}
          >
            <DialogContent className="md:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#0F172A]">Assign equipment</DialogTitle>
                <DialogDescription>
                  Pick inventory category, then equipment type, then a specific available line item (same rules as team inventory).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[#64748B] text-sm">Step 1 — Inventory category</Label>
                  <select
                    className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
                    value={assignBucket}
                    onChange={(e) => {
                      setAssignBucket(e.target.value)
                      setAssignEquipmentType("")
                      setAssignSelectedItemId("")
                    }}
                    aria-label="Inventory category"
                  >
                    <option value="">Select category…</option>
                    {assignBucketOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#64748B] text-sm">Step 2 — Equipment type</Label>
                  <select
                    className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] disabled:opacity-60"
                    value={assignEquipmentType}
                    onChange={(e) => {
                      setAssignEquipmentType(e.target.value)
                      setAssignSelectedItemId("")
                    }}
                    disabled={!assignBucket.trim() || assignTypeOptionsInBucket.length === 0}
                    aria-label="Equipment type within category"
                  >
                    <option value="">
                      {!assignBucket.trim()
                        ? "Select a category first…"
                        : assignTypeOptionsInBucket.length === 0
                          ? "No types in this category"
                          : "Select equipment type…"}
                    </option>
                    {assignTypeOptionsInBucket.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#64748B] text-sm">Step 3 — Specific item</Label>
                  <select
                    className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] disabled:opacity-60"
                    value={assignSelectedItemId}
                    onChange={(e) => setAssignSelectedItemId(e.target.value)}
                    disabled={
                      !assignBucket.trim() ||
                      !assignEquipmentType.trim() ||
                      itemsForAssignSelection.length === 0
                    }
                    aria-label="Specific inventory item"
                  >
                    <option value="">
                      {!assignEquipmentType.trim()
                        ? "Select equipment type first…"
                        : itemsForAssignSelection.length === 0
                          ? "No matching items"
                          : "Select item…"}
                    </option>
                    {itemsForAssignSelection.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                        {i.condition ? ` — ${i.condition}` : ""}
                        {i.size ? ` (${i.size})` : ""}
                      </option>
                    ))}
                  </select>
                  {assignEquipmentType && itemsForAssignSelection.length === 0 && (
                    <p className="text-xs text-amber-800">No assignable items for this category and type right now.</p>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setAssignModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => assignSelectedItemId && void handleAssign(assignSelectedItemId)}
                  disabled={!assignSelectedItemId || !!assignItemId}
                >
                  {assignItemId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign to player"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              const dmg = (i as { damageReportText?: string | null }).damageReportText
              const dmgAt = (i as { damageReportedAt?: string | null }).damageReportedAt
              return (
                <li key={id || name} className="flex flex-col gap-2 px-4 py-3 border-b border-[#E5E7EB] last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-[#0F172A]">{name}</span>
                      <span className="ml-2 text-sm text-[#64748B]">
                        {[category, condition, status].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </div>
                    {canEdit && !isOwnProfile && id && (
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
                  </div>
                  {dmg && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <span className="font-semibold">Damage report: </span>
                      <span className="whitespace-pre-wrap">{dmg}</span>
                      {dmgAt && (
                        <p className="mt-1 text-xs text-amber-800/80">
                          {new Date(dmgAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                  {isOwnProfile && id && (
                    <div className="rounded-md border border-[#E5E7EB] bg-white p-3 space-y-2">
                      <Label className="text-xs text-[#64748B]">Report damage or issue</Label>
                      <textarea
                        className="w-full min-h-[72px] rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
                        placeholder="Describe what happened…"
                        value={damageDraft[id] ?? ""}
                        onChange={(e) => setDamageDraft((d) => ({ ...d, [id]: e.target.value }))}
                        disabled={damageSubmitting === id}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={damageSubmitting === id || !(damageDraft[id] ?? "").trim()}
                        onClick={async () => {
                          const msg = (damageDraft[id] ?? "").trim()
                          if (!msg) return
                          setDamageSubmitting(id)
                          try {
                            const res = await fetch(
                              `/api/teams/${teamId}/inventory/${id}/damage-report`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ message: msg }),
                              }
                            )
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}))
                              throw new Error((data as { error?: string }).error ?? "Failed to send report")
                            }
                            setDamageDraft((d) => ({ ...d, [id]: "" }))
                            onProfileRefetch?.()
                          } catch (err) {
                            setEquipmentError(err instanceof Error ? err.message : "Report failed")
                          } finally {
                            setDamageSubmitting(null)
                          }
                        }}
                      >
                        {damageSubmitting === id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit report"}
                      </Button>
                    </div>
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

const DOC_FILTER_OPTIONS = ["all", ...DOCUMENT_TYPES] as const

/** Types highlighted as common for compliance (physical + waiver match readiness requiredDocsComplete; eligibility aligns with eligibilityOnFile). */
const DOC_TYPE_COMPLIANCE_BADGE = new Set<string>(["physical", "waiver", "eligibility"])

type PlayerDocumentRow = {
  id: string
  title: string
  fileName: string
  mimeType?: string | null
  documentType: string
  createdAt: string
  expiresAt: string | null
  effectiveStatus: "active" | "expired" | "deleted"
  visibleToPlayer?: boolean
  uploadedBy: string | null
  storageBacked?: boolean
  legacyFileUrl?: string | null
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

function DocumentsTab({ playerId, teamId }: { playerId: string; teamId: string }) {
  const [docs, setDocs] = useState<PlayerDocumentRow[]>([])
  const [access, setAccess] = useState<{
    canUpload: boolean
    canExport: boolean
    canDelete: boolean
    canManageVisibility: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [visibilityTogglingId, setVisibilityTogglingId] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [includeExpired, setIncludeExpired] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(() => {
    setLoading(true)
    const q = includeExpired ? "includeExpired=1" : ""
    fetch(`/api/player-documents?teamId=${encodeURIComponent(teamId)}&playerId=${encodeURIComponent(playerId)}&${q}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          documents?: PlayerDocumentRow[]
          access?: { canUpload: boolean; canExport: boolean; canDelete: boolean; canManageVisibility: boolean }
        } | null) => {
          setDocs(Array.isArray(data?.documents) ? data!.documents : [])
          setAccess(data?.access ?? null)
        }
      )
      .catch(() => {
        setDocs([])
        setAccess(null)
      })
      .finally(() => setLoading(false))
  }, [playerId, teamId, includeExpired])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  const filteredDocs =
    categoryFilter === "all" ? docs : docs.filter((d) => d.documentType === categoryFilter)

  const openSigned = async (docId: string, intent: "view" | "download", fileName: string) => {
    setOpeningId(docId)
    setUploadError(null)
    try {
      const res = await fetch(
        `/api/player-documents/${docId}/signed-url?teamId=${encodeURIComponent(teamId)}&playerId=${encodeURIComponent(playerId)}&intent=${intent}`,
        { method: "POST" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Could not open document")
      }
      const url = (data as { url?: string }).url
      if (!url) throw new Error("No file URL returned")
      if (intent === "download") {
        try {
          const fileRes = await fetch(url)
          if (!fileRes.ok) throw new Error("Download failed")
          const blob = await fileRes.blob()
          const obj = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = obj
          a.download = fileName || "document"
          a.rel = "noopener"
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(obj)
        } catch {
          window.open(url, "_blank", "noopener,noreferrer")
        }
      } else {
        window.open(url, "_blank", "noopener,noreferrer")
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Could not open document")
    } finally {
      setOpeningId(null)
    }
  }

  const applyDroppedFile = (file: File) => {
    const input = fileInputRef.current
    if (!input) return
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
  }

  const handleExport = async () => {
    if (!access?.canExport || docs.length === 0) return
    try {
      const res = await fetch("/api/player-documents/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          playerId,
          documentIds: docs.map((d) => d.id),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Export failed")
      }
      const items = (data as { items?: { url: string | null }[] }).items ?? []
      for (const it of items) {
        if (it.url) window.open(it.url, "_blank", "noopener,noreferrer")
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Export failed")
    }
  }

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const file = (form.elements.namedItem("docFile") as HTMLInputElement)?.files?.[0]
    const title = (form.elements.namedItem("docTitle") as HTMLInputElement)?.value?.trim() || "Document"
    if (!file) {
      setUploadError("Select a file")
      return
    }
    if (!consentChecked) {
      setUploadError("You must confirm consent before uploading.")
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", title)
      formData.append("teamId", teamId)
      formData.append("playerId", playerId)
      formData.append("documentType", (form.elements.namedItem("docCategory") as HTMLSelectElement)?.value || "other")
      formData.append("seasonLabel", (form.elements.namedItem("seasonLabel") as HTMLInputElement)?.value ?? "")
      formData.append("retentionDays", "365")
      formData.append("consent", "true")
      const res = await fetch("/api/player-documents/upload", { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Upload failed")
      }
      const body = await res.json().catch(() => ({}))
      const exp = (body as { expiresAt?: string }).expiresAt
      loadDocs()
      form.reset()
      setConsentChecked(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (exp) {
        setUploadError(null)
      }
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
      const res = await fetch(
        `/api/player-documents/${docId}?teamId=${encodeURIComponent(teamId)}&playerId=${encodeURIComponent(playerId)}`,
        { method: "DELETE" }
      )
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

  const canUploadUi = access?.canUpload === true
  const canDeleteUi = access?.canDelete === true
  const canExportUi = access?.canExport === true
  const canVis = access?.canManageVisibility === true

  /** Allow open unless API explicitly marked not storage-backed with no legacy URL. */
  const docHasRetrievableFile = (d: PlayerDocumentRow) =>
    !(d.storageBacked === false && !d.legacyFileUrl?.trim())

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
      <p className="text-xs text-[#64748B] leading-relaxed max-w-2xl">
        Participation paperwork (physicals, waivers, permission slips) is stored separately from the health dashboard.{" "}
        {PLAYER_DOCUMENT_UPLOAD_HELPER}
      </p>

      {canUploadUi && (
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <Label className="text-[#0F172A] font-medium">Upload document</Label>
          <p className="mt-1 text-xs text-[#64748B]">PDF, images, or Word. Max 15MB.</p>
          <form onSubmit={handleUpload} className="mt-3 space-y-3">
            <div
              className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                dragActive ? "border-[#3B82F6] bg-blue-50/40" : "border-[#E5E7EB]"
              }`}
              onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setDragActive(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setDragActive(false)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setDragActive(false)
                const f = e.dataTransfer.files?.[0]
                if (f) applyDroppedFile(f)
              }}
            >
              <p className="text-sm text-[#64748B] mb-2">Drag and drop a file here, or choose a file below.</p>
              <input
                ref={fileInputRef}
                type="file"
                name="docFile"
                accept=".pdf,image/*,.doc,.docx,.txt"
                className="max-w-xs text-sm"
                required
              />
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
              <Input name="docTitle" placeholder="Title" className="max-w-[200px]" />
              <select name="docCategory" className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm min-w-[160px]" aria-label="Document type">
                {DOCUMENT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {DOCUMENT_TYPE_LABELS[c]}
                    {DOC_TYPE_COMPLIANCE_BADGE.has(c) ? " (common)" : ""}
                  </option>
                ))}
              </select>
              <Input name="seasonLabel" placeholder="Season (optional)" className="max-w-[160px]" />
              <label className="flex items-start gap-2 text-sm text-[#0F172A] max-w-md">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-1 rounded border-[#E5E7EB]"
                />
                <span>{PLAYER_DOCUMENT_CONSENT_TEXT}</span>
              </label>
              <Button type="submit" disabled={uploading || !consentChecked}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                <span className="ml-2">{uploading ? "Uploading..." : "Upload"}</span>
              </Button>
            </div>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {docs.length > 0 && (
          <>
            <Label className="text-[#64748B] text-sm">Type</Label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
            >
              {DOC_FILTER_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All" : DOCUMENT_TYPE_LABELS[c as DocumentType]}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="flex items-center gap-2 text-sm text-[#64748B]">
          <input
            type="checkbox"
            checked={includeExpired}
            onChange={(e) => setIncludeExpired(e.target.checked)}
            className="rounded border-[#E5E7EB]"
          />
          Show expired
        </label>
        {canExportUi && docs.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => void handleExport()}>
            Export / download (staff)
          </Button>
        )}
      </div>

      {filteredDocs.length > 0 ? (
        <ul className="divide-y divide-[#E5E7EB] rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
          {filteredDocs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#E2E8F0] px-2 py-0.5 text-xs font-medium text-[#475569]">
                    {getFileTypeBadge(d.fileName, d.mimeType)}
                  </span>
                  <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-xs text-[#64748B]">
                    {DOCUMENT_TYPE_LABELS[d.documentType as DocumentType] ?? d.documentType}
                  </span>
                  {DOC_TYPE_COMPLIANCE_BADGE.has(d.documentType) && (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Common for compliance</span>
                  )}
                  <span
                    className={
                      d.effectiveStatus === "active"
                        ? "rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900"
                        : d.effectiveStatus === "expired"
                          ? "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                          : "rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800"
                    }
                  >
                    {d.effectiveStatus === "active" ? "Active" : d.effectiveStatus === "expired" ? "Expired" : "Deleted"}
                  </span>
                  {canVis && d.visibleToPlayer === false && (
                    <span className="text-xs text-amber-600">Hidden from player</span>
                  )}
                </div>
                {d.effectiveStatus === "expired" && (
                  <p className="mt-1 text-xs text-amber-800">This file is past its retention date. Staff can still review; players may be blocked from opening.</p>
                )}
                <button
                  type="button"
                  className="mt-1 font-medium text-[#0F172A] hover:text-[#3B82F6] flex items-center gap-1 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => void openSigned(d.id, "view", d.fileName)}
                  disabled={openingId === d.id || !docHasRetrievableFile(d)}
                  title={!docHasRetrievableFile(d) ? "File is not available in storage" : undefined}
                >
                  {d.title}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </button>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {d.fileName}
                  {d.uploadedBy && ` · Uploaded by ${d.uploadedBy}`}
                  {d.createdAt && ` · ${formatDocDate(d.createdAt)}`}
                  {d.expiresAt && ` · Expires ${formatDocDate(d.expiresAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[#3B82F6]"
                  onClick={() => void openSigned(d.id, "download", d.fileName)}
                  disabled={openingId === d.id || !docHasRetrievableFile(d)}
                  title={!docHasRetrievableFile(d) ? "File is not available in storage" : undefined}
                >
                  Open
                </Button>
                {canVis && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#64748B]"
                    title={d.visibleToPlayer !== false ? "Hide from player" : "Show to player"}
                    onClick={() => handleVisibilityToggle(d.id, d.visibleToPlayer !== false)}
                    disabled={visibilityTogglingId === d.id}
                  >
                    {visibilityTogglingId === d.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : d.visibleToPlayer !== false ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {canDeleteUi && (
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
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-8 text-center">
          <p className="text-sm text-[#64748B]">
            {docs.length === 0
              ? "No documents yet."
              : `No documents in ${categoryFilter === "all" ? "any" : DOCUMENT_TYPE_LABELS[categoryFilter as DocumentType]} type.`}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {canUploadUi ? "Upload forms, waivers, or permission slips above." : "Documents will appear here when added."}
          </p>
        </div>
      )}
    </div>
  )
}

type InjuryListRow = {
  id: string
  player_id: string
  injury_reason: string
  injury_date: string
  expected_return_date: string | null
  actual_return_date: string | null
  status: string
  notes: string | null
  severity: string | null
}

function HealthTab({
  playerId,
  teamId,
  profile,
  canEditMedical,
  setEditDraft,
  value,
  onProfileRefetch,
}: {
  playerId: string
  teamId: string
  profile: PlayerProfile
  canEditMedical: boolean
  setEditDraft: (d: Partial<PlayerProfile> | ((prev: Partial<PlayerProfile>) => Partial<PlayerProfile>)) => void
  value: (k: keyof PlayerProfile) => unknown
  onProfileRefetch?: () => void
}) {
  const [injuries, setInjuries] = useState<InjuryListRow[]>([])
  const [injLoading, setInjLoading] = useState(true)
  const [injuriesForbidden, setInjuriesForbidden] = useState(false)
  const [injuryModalOpen, setInjuryModalOpen] = useState(false)
  const [injurySaving, setInjurySaving] = useState(false)
  const [injuryFormError, setInjuryFormError] = useState<string | null>(null)
  const [injuryReason, setInjuryReason] = useState("")
  const [injuryDate, setInjuryDate] = useState("")
  const [injuryExpectedReturn, setInjuryExpectedReturn] = useState("")
  const [injuryNotes, setInjuryNotes] = useState("")
  const [injurySeverity, setInjurySeverity] = useState("")
  const [injuryExemptPractice, setInjuryExemptPractice] = useState(false)

  const loadInjuries = useCallback(() => {
    setInjLoading(true)
    setInjuriesForbidden(false)
    fetch(`/api/health/injuries?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => {
        if (res.status === 403) {
          setInjuriesForbidden(true)
          return { injuries: [] }
        }
        return res.ok ? res.json() : { injuries: [] }
      })
      .then((data: { injuries?: InjuryListRow[] }) => {
        const all = Array.isArray(data?.injuries) ? data.injuries : []
        setInjuries(all.filter((i) => i.player_id === playerId))
      })
      .catch(() => setInjuries([]))
      .finally(() => setInjLoading(false))
  }, [teamId, playerId])

  useEffect(() => {
    loadInjuries()
  }, [loadInjuries])

  useEffect(() => {
    if (!injuryModalOpen) return
    const t = new Date()
    setInjuryDate((d) => d || dateToYmd(t))
  }, [injuryModalOpen])

  const statusDisplay = getProfileStatusDisplay(profile)
  const medicalCanEdit = canEditMedical
  const rosterStatusVal = String(value("activeStatus") ?? profile.activeStatus ?? "active").toLowerCase()
  const suspensionEndVal = String(value("suspensionEndDate") ?? profile.suspensionEndDate ?? "").slice(0, 10)

  const submitInjury = async () => {
    const reason = injuryReason.trim()
    if (!reason) {
      setInjuryFormError("Describe the injury or reason.")
      return
    }
    setInjuryFormError(null)
    setInjurySaving(true)
    try {
      const res = await fetch("/api/health/injuries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          teamId,
          injuryReason: reason,
          injuryDate: injuryDate || undefined,
          expectedReturnDate: injuryExpectedReturn || undefined,
          notes: injuryNotes.trim() || undefined,
          severity: injurySeverity.trim() || undefined,
          exemptFromPractice: injuryExemptPractice,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Failed to add injury")
      }
      setInjuryModalOpen(false)
      setInjuryReason("")
      setInjuryExpectedReturn("")
      setInjuryNotes("")
      setInjurySeverity("")
      setInjuryExemptPractice(false)
      loadInjuries()
      onProfileRefetch?.()
    } catch (e) {
      setInjuryFormError(e instanceof Error ? e.message : "Failed to add injury")
    } finally {
      setInjurySaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Status & eligibility</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#64748B]">Player status:</span>
          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusDisplay.chipClass}`}>{statusDisplay.label}</span>
          {rosterStatusVal === "suspended" && suspensionEndVal && (
            <span className="text-xs text-[#64748B]">
              (through {formatDocDate(suspensionEndVal)})
            </span>
          )}
          <span className="text-xs text-[#64748B] ml-2">Eligibility:</span>
          <span className="text-xs font-medium text-[#0F172A]">{profile.eligibilityStatus?.trim() || "—"}</span>
        </div>
      </div>

      {medicalCanEdit && (
        <div className="space-y-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Roster & availability (save with profile)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[#64748B]">Roster status</Label>
              <select
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
                value={String(value("activeStatus") ?? profile.activeStatus ?? "active")}
                onChange={(e) => {
                  const v = e.target.value
                  setEditDraft((p) => ({
                    ...p,
                    activeStatus: v,
                    ...(v.toLowerCase() !== "suspended" ? { suspensionEndDate: null } : {}),
                  }))
                }}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="text-xs text-[#94A3B8]">Suspended shows orange in the profile banner.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#64748B]">Health availability</Label>
              <select
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A]"
                value={String(value("healthStatus") ?? profile.healthStatus ?? "active")}
                onChange={(e) =>
                  setEditDraft((p) => ({
                    ...p,
                    healthStatus: e.target.value as PlayerProfile["healthStatus"],
                  }))
                }
              >
                <option value="active">Available</option>
                <option value="injured">Injured</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>
          {rosterStatusVal === "suspended" && (
            <div className="space-y-1.5">
              <Label className="text-[#64748B]">Suspension expected through (optional)</Label>
              <Input
                type="date"
                value={suspensionEndVal}
                onChange={(e) => setEditDraft((p) => ({ ...p, suspensionEndDate: e.target.value || null }))}
                className="max-w-[200px]"
              />
              <p className="text-xs text-[#94A3B8]">Target date for lifting roster suspension; staff reference only.</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-[#64748B]">Injury report / history</Label>
          {medicalCanEdit && !injuriesForbidden && (
            <Button type="button" size="sm" variant="outline" onClick={() => setInjuryModalOpen(true)}>
              Add injury
            </Button>
          )}
        </div>
        <p className="text-xs text-[#94A3B8]">Team injury records for this player. Add new entries below when appropriate.</p>
        {injLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
          </div>
        ) : injuriesForbidden ? (
          <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-6 text-center text-sm text-[#64748B]">
            Injury history is visible to coaching staff with roster access.
          </div>
        ) : injuries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-6 text-center text-sm text-[#64748B]">
            No injury records on file.
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E7EB] rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
            {injuries.map((inj) => (
              <li key={inj.id} className="px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-[#0F172A]">{inj.injury_reason}</span>
                  <span className="text-xs text-[#94A3B8]">{new Date(inj.injury_date).toLocaleDateString()}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#64748B]">
                  <span>Status: {inj.status}</span>
                  {inj.severity ? <span>Severity: {inj.severity}</span> : null}
                  {inj.expected_return_date ? (
                    <span>Expected return: {new Date(inj.expected_return_date).toLocaleDateString()}</span>
                  ) : null}
                  {inj.actual_return_date ? (
                    <span>Returned: {new Date(inj.actual_return_date).toLocaleDateString()}</span>
                  ) : null}
                </div>
                {inj.notes?.trim() ? <p className="mt-1.5 whitespace-pre-wrap text-xs text-[#475569]">{inj.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={injuryModalOpen} onOpenChange={setInjuryModalOpen}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#0F172A]">Add injury record</DialogTitle>
            <DialogDescription>Creates a team injury entry for this player (same data as the health dashboard API).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[#64748B]">Injury / reason</Label>
              <Input
                value={injuryReason}
                onChange={(e) => setInjuryReason(e.target.value)}
                placeholder="e.g. Ankle sprain — practice"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[#64748B]">Injury date</Label>
                <Input type="date" value={injuryDate} onChange={(e) => setInjuryDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#64748B]">Expected return</Label>
                <Input type="date" value={injuryExpectedReturn} onChange={(e) => setInjuryExpectedReturn(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#64748B]">Severity (optional)</Label>
              <select
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
                value={injurySeverity}
                onChange={(e) => setInjurySeverity(e.target.value)}
              >
                <option value="">—</option>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#64748B]">Notes</Label>
              <textarea
                className="min-h-[72px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                value={injuryNotes}
                onChange={(e) => setInjuryNotes(e.target.value)}
                placeholder="Optional details…"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#0F172A]">
              <input
                type="checkbox"
                checked={injuryExemptPractice}
                onChange={(e) => setInjuryExemptPractice(e.target.checked)}
                className="rounded border-[#E5E7EB]"
              />
              Exempt from practice
            </label>
            {injuryFormError && <p className="text-sm text-red-600">{injuryFormError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInjuryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitInjury()} disabled={injurySaving}>
              {injurySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save injury"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <Label className="text-[#64748B]">Medical alerts</Label>
        {medicalCanEdit ? (
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A]"
            value={String(value("medicalAlerts") ?? "")}
            onChange={(e) => setEditDraft((p) => ({ ...p, medicalAlerts: e.target.value || null }))}
            placeholder="Short alerts for staff…"
          />
        ) : (
          <p className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A]">{profile.medicalAlerts?.trim() || "—"}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-[#64748B]">Medical notes</Label>
        {medicalCanEdit ? (
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A]"
            value={String(value("medicalNotes") ?? "")}
            onChange={(e) => setEditDraft((p) => ({ ...p, medicalNotes: e.target.value || null }))}
            placeholder="Medical notes…"
          />
        ) : (
          <p className="whitespace-pre-wrap rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A]">{profile.medicalNotes?.trim() || "—"}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[#64748B]">Emergency contact</Label>
          {medicalCanEdit ? (
            <Input
              value={String(value("emergencyContact") ?? "")}
              onChange={(e) => setEditDraft((p) => ({ ...p, emergencyContact: e.target.value || null }))}
              placeholder="Name / phone"
            />
          ) : (
            <p className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A]">{profile.emergencyContact?.trim() || "—"}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-[#64748B]">Relationship to player</Label>
          {medicalCanEdit ? (
            <Input
              value={String(value("emergencyContactRelationship") ?? "")}
              onChange={(e) => setEditDraft((p) => ({ ...p, emergencyContactRelationship: e.target.value || null }))}
              placeholder="e.g. Mother"
            />
          ) : (
            <p className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A]">{profile.emergencyContactRelationship?.trim() || "—"}</p>
          )}
        </div>
      </div>
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
  { value: "", label: "All events" },
  { value: "profile_updated", label: "Profile updated" },
  { value: "stats_updated", label: "Stats updated" },
  { value: "photo_changed", label: "Photo changed" },
  { value: "photo_removed", label: "Photo removed" },
  { value: "document_uploaded", label: "Document uploaded" },
  { value: "document_deleted", label: "Document removed" },
  { value: "equipment_assigned", label: "Equipment assigned" },
  { value: "equipment_unassigned", label: "Equipment unassigned" },
]

function HistoryTab({ playerId, teamId }: { playerId: string; teamId: string }) {
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
          <label htmlFor="history-type-filter" className="text-sm text-[#64748B]">Filter:</label>
          <select
            id="history-type-filter"
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
          <p className="mt-3 text-sm text-[#64748B]">No history yet.</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {actionTypeFilter ? "No matching events for this filter." : "Photo, profile, document, and equipment changes will appear here."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[#64748B]">Recent changes to this profile (history).</p>
        <div className="flex items-center gap-2">
          <label htmlFor="history-type-filter-filled" className="text-sm text-[#64748B]">Filter:</label>
          <select
            id="history-type-filter-filled"
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
