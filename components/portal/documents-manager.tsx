"use client"

import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { format } from "date-fns"
import { FileText, File, Lock, Users, User, Trash2, Plus, Share2, Copy } from "lucide-react"
import { canManageTeam, type Role } from "@/lib/auth/roles"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Document {
  id: string
  title: string
  fileName: string
  category: string
  folder: string | null
  visibility: string
  scopedUnit: string | null
  scopedPositionGroups: unknown
  assignedPlayerIds: unknown
  createdAt: Date
  mimeType?: string | null
  publicShareToken?: string | null
  /** True when file bytes live in Supabase Storage (private bucket); legacy rows may be disk-only. */
  storageBacked?: boolean
  sharedWith?: Array<{ id: string; name: string | null; email: string }>
  creator: { name: string | null; email: string }
  acknowledgements: Array<{ id: string }>
}

const TEAM_DOC_CATEGORY_KEYS = [
  "team",
  "coaching_staff",
  "medical_eligibility",
  "financial",
  "media_images",
  "legal_compliance",
] as const
type TeamDocCategory = (typeof TEAM_DOC_CATEGORY_KEYS)[number]

const TEAM_DOC_TAB_LABELS: Record<TeamDocCategory, string> = {
  team: "Team",
  coaching_staff: "Coaching Staff",
  medical_eligibility: "Medical & Eligibility",
  financial: "Financial",
  media_images: "Media & Images",
  legal_compliance: "Legal & Compliance",
}

function visibleTeamDocTabs(userRole: string | undefined): TeamDocCategory[] {
  const r = (userRole ?? "").toUpperCase()
  const all = [...TEAM_DOC_CATEGORY_KEYS] as TeamDocCategory[]
  if (r === "HEAD_COACH" || r === "ATHLETIC_DIRECTOR" || r === "SCHOOL_ADMIN") return all
  if (r === "ASSISTANT_COACH") {
    return all.filter((x) => x !== "financial" && x !== "legal_compliance")
  }
  if (r === "PLAYER" || r === "PARENT") {
    return ["team", "medical_eligibility", "media_images"]
  }
  return ["team", "media_images"]
}

function normalizeTeamDocCategory(raw: string | null | undefined): TeamDocCategory {
  const s = (raw ?? "").trim()
  if ((TEAM_DOC_CATEGORY_KEYS as readonly string[]).includes(s)) return s as TeamDocCategory
  return "team"
}

function parseAssignedPlayerIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0)
}

type Contact = { id: string; name: string; email: string }

export function DocumentsManager({
  teamId,
  documents: initialDocuments,
  canUploadCoachCategories,
  allowPlayerParentMediaUpload = false,
  userRole,
  /** Parent is fetching first page — show grid skeleton but keep chrome interactive */
  listLoading = false,
}: {
  teamId: string
  documents: Document[]
  canUploadCoachCategories: boolean
  allowPlayerParentMediaUpload?: boolean
  userRole?: string
  listLoading?: boolean
}) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDocuments(initialDocuments)
  }, [initialDocuments])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  const visibleTabs = useMemo(() => visibleTeamDocTabs(userRole), [userRole])
  const [activeTeamCategoryTab, setActiveTeamCategoryTab] = useState<TeamDocCategory>("team")
  const [viewerPlayerId, setViewerPlayerId] = useState<string | null>(null)

  useEffect(() => {
    if (!visibleTabs.includes(activeTeamCategoryTab)) {
      setActiveTeamCategoryTab(visibleTabs[0] ?? "team")
    }
  }, [visibleTabs, activeTeamCategoryTab])

  useEffect(() => {
    if (userRole !== "PLAYER" || !teamId) {
      setViewerPlayerId(null)
      return
    }
    let cancelled = false
    fetch(`/api/roster/me?teamId=${encodeURIComponent(teamId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { playerId?: string | null } | null) => {
        if (!cancelled && j?.playerId) setViewerPlayerId(j.playerId)
        else if (!cancelled) setViewerPlayerId(null)
      })
      .catch(() => {
        if (!cancelled) setViewerPlayerId(null)
      })
    return () => {
      cancelled = true
    }
  }, [teamId, userRole])

  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<TeamDocCategory>("team")
  const [folder, setFolder] = useState("")
  const [visibility, setVisibility] = useState("all")
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [shareDoc, setShareDoc] = useState<Document | null>(null)
  const [shareContacts, setShareContacts] = useState<Contact[]>([])
  const [sharePick, setSharePick] = useState("")
  const [shareSaving, setShareSaving] = useState(false)
  const [publicEnabled, setPublicEnabled] = useState(false)

  const refreshDocuments = useCallback(async (): Promise<Document[] | null> => {
    const res = await fetch(`/api/documents?teamId=${encodeURIComponent(teamId)}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data)) return null
    const mapped: Document[] = data.map((d: Document & { createdAt: string | Date }) => ({
      ...d,
      createdAt: typeof d.createdAt === "string" ? new Date(d.createdAt) : d.createdAt,
    }))
    setDocuments(mapped)
    return mapped
  }, [teamId])

  const folders = useMemo(() => {
    const folderSet = new Set<string>()
    documents.forEach((doc) => {
      if (doc.folder) {
        folderSet.add(doc.folder)
      }
    })
    return Array.from(folderSet).sort()
  }, [documents])

  const filteredByFolderCategory = useMemo(() => {
    let filtered = documents
    if (selectedFolder) {
      filtered = filtered.filter((doc) => doc.folder === selectedFolder)
    }
    filtered = filtered.filter((doc) => normalizeTeamDocCategory(doc.category) === activeTeamCategoryTab)
    if (
      activeTeamCategoryTab === "medical_eligibility" &&
      userRole === "PLAYER" &&
      viewerPlayerId
    ) {
      filtered = filtered.filter((doc) => {
        const ids = parseAssignedPlayerIds(doc.assignedPlayerIds)
        return ids.length === 0 || ids.includes(viewerPlayerId)
      })
    }
    return filtered
  }, [documents, selectedFolder, activeTeamCategoryTab, userRole, viewerPlayerId])

  const visibleDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return filteredByFolderCategory
    return filteredByFolderCategory.filter((doc) => {
      const creatorLabel = (doc.creator?.name || doc.creator?.email || "").toLowerCase()
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q) ||
        creatorLabel.includes(q) ||
        (doc.folder && doc.folder.toLowerCase().includes(q))
      )
    })
  }, [filteredByFolderCategory, searchQuery])

  const canShowUploadButton =
    canUploadCoachCategories ||
    (allowPlayerParentMediaUpload && activeTeamCategoryTab === "media_images")

  const handlePickFile = () => {
    fileInputRef.current?.click()
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    setFile(f)
    setTitle(f.name.replace(/\.[^/.]+$/, "") || f.name)
    setCategory(
      allowPlayerParentMediaUpload && !canUploadCoachCategories
        ? "media_images"
        : activeTeamCategoryTab
    )
    setShowUploadDialog(true)
  }

  const handleUpload = async () => {
    if (!title || !file) {
      alert("Title and file are required")
      return
    }

    setLoading(true)
    try {
      const uploadCategory: TeamDocCategory = canUploadCoachCategories ? category : "media_images"
      const formData = new FormData()
      formData.append("file", file)
      formData.append("teamId", teamId)
      formData.append("title", title)
      formData.append("category", uploadCategory)
      formData.append("visibility", visibility)
      if (folder.trim()) {
        formData.append("folder", folder.trim())
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error((error as { error?: string }).error || "Failed to upload document")
      }

      const refreshed = await refreshDocuments()
      if (!refreshed) {
        throw new Error("Upload saved but failed to refresh the document list. Try reloading the page.")
      }
      setTitle("")
      setFolder("")
      setFile(null)
      setShowUploadDialog(false)
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Error uploading document")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this document?")) {
      return
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete document")
      }

      setDocuments(documents.filter((doc) => doc.id !== documentId))
    } catch {
      alert("Error deleting document")
    }
  }

  const handleCardClick = (docId: string) => {
    window.open(`/api/documents/${docId}`, "_blank")
  }

  const openShare = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation()
    setShareDoc(doc)
    setPublicEnabled(!!doc.publicShareToken)
    setSharePick("")
    try {
      const res = await fetch(`/api/messages/contacts?teamId=${encodeURIComponent(teamId)}`)
      if (res.ok) {
        const data = (await res.json()) as Contact[]
        setShareContacts(Array.isArray(data) ? data : [])
      } else {
        setShareContacts([])
      }
    } catch {
      setShareContacts([])
    }
  }

  const applyShareUpdate = async (body: Record<string, unknown>) => {
    if (!shareDoc) return
    const docId = shareDoc.id
    setShareSaving(true)
    try {
      const res = await fetch(`/api/documents/${docId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Failed to update sharing")
      }
      const list = await refreshDocuments()
      const latest = list?.find((d) => d.id === docId)
      if (latest) {
        setShareDoc(latest)
        setPublicEnabled(!!latest.publicShareToken)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Share update failed")
    } finally {
      setShareSaving(false)
    }
  }

  const addShareUser = async () => {
    if (!sharePick) return
    await applyShareUpdate({ addUserIds: [sharePick] })
    setSharePick("")
  }

  const removeShareUser = async (userId: string) => {
    await applyShareUpdate({ removeUserIds: [userId] })
  }

  const togglePublic = async (enabled: boolean) => {
    setPublicEnabled(enabled)
    await applyShareUpdate({ publicShareEnabled: enabled })
  }

  const copyPublicLink = (token: string | null | undefined) => {
    if (!token) return
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/documents/public/${token}`
    void navigator.clipboard.writeText(url)
  }

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case "staff":
        return { icon: Lock, label: "Coaches", color: "#0B2A5B" }
      case "players":
        return { icon: Users, label: "Players", color: "#0B2A5B" }
      case "parents":
        return { icon: User, label: "Parents", color: "#0B2A5B" }
      default:
        return { icon: Users, label: "All", color: "#0B2A5B" }
    }
  }

  const getFileType = (fileName: string, mimeType?: string | null) => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    if (mimeType?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return "image"
    }
    if (ext === "pdf" || mimeType === "application/pdf") {
      return "pdf"
    }
    if (["doc", "docx"].includes(ext || "") || mimeType?.includes("word")) {
      return "docx"
    }
    return "other"
  }

  const getPreviewUrl = (doc: Document) => {
    const fileType = getFileType(doc.fileName, doc.mimeType)
    if (fileType === "image") {
      return `/api/documents/${doc.id}`
    }
    return null
  }

  const currentShare = shareDoc ? documents.find((d) => d.id === shareDoc.id) ?? shareDoc : null

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,application/pdf,text/plain"
        onChange={onFileInputChange}
      />

      <PortalUnderlineTabs
        emphasized
        tabs={visibleTabs.map((id) => ({
          id,
          label: TEAM_DOC_TAB_LABELS[id],
        }))}
        value={activeTeamCategoryTab}
        onValueChange={(id) => setActiveTeamCategoryTab(id as TeamDocCategory)}
        ariaLabel="Document categories"
        className="mb-4"
      />

      {/* Top: search + add (desktop: slightly wider cards in grid below) */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="search"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-w-0"
            aria-label="Search documents"
          />
          {canShowUploadButton && (
            <Button type="button" onClick={handlePickFile} className="shrink-0 gap-1" title="Add document">
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add document</span>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {folders.length > 0 && (
            <select
              value={selectedFolder || ""}
              onChange={(e) => setSelectedFolder(e.target.value || null)}
              className="flex h-10 rounded-md border-2 border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">All Folders</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              {file ? file.name : "Choose a file using the + button."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                {canUploadCoachCategories ? (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TeamDocCategory)}
                    className="flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    {visibleTabs.map((id) => (
                      <option key={id} value={id}>
                        {TEAM_DOC_TAB_LABELS[id]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    {TEAM_DOC_TAB_LABELS.media_images} (player/parent uploads)
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Visibility</Label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="all">All</option>
                  <option value="staff">Staff Only</option>
                  <option value="players">Players</option>
                  <option value="parents">Parents (Explicit Share)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Folder (optional)</Label>
              <Input
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="e.g., Offense/Passing, Defense/Base"
              />
              <p className="text-xs text-muted-foreground">Use forward slashes (/) to create nested folders</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpload} disabled={loading || !file}>
              {loading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareDoc} onOpenChange={(o) => !o && setShareDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share document</DialogTitle>
            <DialogDescription className="line-clamp-2">
              {currentShare?.title}
            </DialogDescription>
          </DialogHeader>
          {currentShare && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Share with team member</Label>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={sharePick}
                    onChange={(e) => setSharePick(e.target.value)}
                    className="min-w-0 flex-1 h-10 rounded-md border-2 border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select user…</option>
                    {shareContacts
                      .filter(
                        (c) => !(currentShare.sharedWith ?? []).some((s) => s.id === c.id)
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.email}
                        </option>
                      ))}
                  </select>
                  <Button type="button" variant="secondary" onClick={addShareUser} disabled={!sharePick || shareSaving}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(currentShare.sharedWith ?? []).map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-xs"
                    >
                      {s.name || s.email}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => removeShareUser(s.id)}
                        disabled={shareSaving}
                        aria-label={`Remove ${s.name || s.email}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2 border-t border-border pt-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={publicEnabled}
                    onChange={(e) => togglePublic(e.target.checked)}
                    disabled={shareSaving}
                  />
                  Public link (anyone with the link can view)
                </label>
                {currentShare.publicShareToken && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => copyPublicLink(currentShare.publicShareToken)}
                    >
                      <Copy className="h-3 w-3" />
                      Copy link
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShareDoc(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
      >
        {listLoading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-xl border border-border bg-card shadow-sm"
                aria-hidden
              />
            ))}
          </>
        ) : visibleDocuments.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No documents found</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          visibleDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              canDelete={Boolean(userRole && canManageTeam(userRole as Role))}
              canShare={canUploadCoachCategories}
              onDelete={handleDelete}
              onClick={handleCardClick}
              onShare={openShare}
              getPreviewUrl={getPreviewUrl}
              getFileType={getFileType}
              getVisibilityBadge={getVisibilityBadge}
            />
          ))
        )}
      </div>
    </div>
  )
}

function DocumentCard({
  doc,
  canDelete,
  canShare,
  onDelete,
  onClick,
  onShare,
  getPreviewUrl,
  getFileType,
  getVisibilityBadge,
}: {
  doc: Document
  canDelete: boolean
  canShare: boolean
  onDelete: (id: string, e: React.MouseEvent) => void
  onClick: (id: string) => void
  onShare: (doc: Document, e: React.MouseEvent) => void
  getPreviewUrl: (doc: Document) => string | null
  getFileType: (fileName: string, mimeType?: string | null) => string
  getVisibilityBadge: (visibility: string) => { icon: typeof Lock; label: string; color: string }
}) {
  const previewUrl = getPreviewUrl(doc)
  const fileType = getFileType(doc.fileName, doc.mimeType)
  const visibilityInfo = getVisibilityBadge(doc.visibility)
  const VisibilityIcon = visibilityInfo.icon

  return (
    <div
      className="document-card"
      onClick={() => onClick(doc.id)}
      style={{
        background: "rgba(255, 255, 255, 0.96)",
        borderRadius: "14px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(11,42,91,0.10)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)"
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.06), 0 18px 42px rgba(11,42,91,0.14)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(11,42,91,0.10)"
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "rgba(11,42,91,0.85)",
          color: "white",
          fontSize: "0.65rem",
          padding: "4px 8px",
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          zIndex: 10,
        }}
      >
        <VisibilityIcon className="h-3 w-3" />
        <span>{visibilityInfo.label}</span>
      </div>

      {canDelete && (
        <button
          onClick={(e) => onDelete(doc.id, e)}
          className="absolute top-2 left-2 z-10 p-1.5 rounded-full bg-red-500 text-white opacity-0 transition-opacity hover:opacity-100"
          style={{ opacity: 0 }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0"
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      <div
        className="document-preview"
        style={{
          height: "200px",
          backgroundColor: "#F1F4F9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {previewUrl && fileType === "image" ? (
          <img
            src={previewUrl}
            alt={doc.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none"
              const parent = e.currentTarget.parentElement
              if (parent) {
                parent.innerHTML = `
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; color: #6B7280;">
                    <span style="font-size: 0.75rem;">Image</span>
                  </div>
                `
              }
            }}
          />
        ) : fileType === "pdf" ? (
          <>
            <iframe
              title=""
              src={`/api/documents/${doc.id}`}
              className="pointer-events-none absolute inset-0 hidden h-full w-full border-0 lg:block"
            />
            <div className="flex h-full w-full flex-col items-center justify-center lg:hidden">
              <FileText className="h-12 w-12 text-red-600 dark:text-red-400" />
              <span className="text-xs">PDF</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {fileType === "docx" ? (
              <>
                <FileText className="h-12 w-12 text-primary" />
                <span className="text-xs">Document</span>
              </>
            ) : (
              <>
                <File className="h-12 w-12" />
                <span className="text-xs">{doc.fileName.split(".").pop()?.toUpperCase() || "File"}</span>
              </>
            )}
          </div>
        )}
        {canShare && (
          <button
            type="button"
            onClick={(e) => onShare(doc, e)}
            className="absolute bottom-2 right-2 z-10 rounded-full bg-background/90 p-1.5 shadow border border-border"
            title="Share"
            aria-label="Share document"
          >
            <Share2 className="h-3.5 w-3.5 text-foreground" />
          </button>
        )}
      </div>

      <div
        className="document-meta"
        style={{
          padding: "12px 14px",
        }}
      >
        <div className="document-title font-semibold text-[0.95rem] mb-1 leading-tight overflow-hidden text-ellipsis line-clamp-2 text-foreground">
          {doc.title}
        </div>
        <div className="document-sub text-xs mt-1 text-muted-foreground">
          {format(new Date(doc.createdAt), "MMM d, yyyy")}
          {doc.creator?.name || doc.creator?.email ? (
            <span className="block truncate">
              {doc.creator?.name || doc.creator?.email}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
