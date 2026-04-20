"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Trash2, Download, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  PLAYER_DOCUMENT_CONSENT_TEXT,
  PLAYER_DOCUMENT_UPLOAD_HELPER,
  DEFAULT_RETENTION_DAYS,
  type DocumentType,
  isPlayerDocumentType,
} from "@/lib/player-documents/constants"

type PlayerDocRow = {
  id: string
  title: string
  fileName: string
  mimeType: string | null
  createdAt: string
  uploadedByProfileId: string | null
  createdByUserId: string | null
  uploadedBy: string | null
  visibleToPlayer: boolean
}

type TeamDocRow = {
  id: string
  title: string
  fileName: string
  category: string
  createdAt: string
  creator: { name: string | null; email: string }
}

function isMyDocumentForParent(parentUserId: string, d: PlayerDocRow): boolean {
  return d.uploadedByProfileId === parentUserId || d.createdByUserId === parentUserId
}

/**
 * Document buckets follow linked-player access rules via `playerId` query params — the parent session never impersonates the athlete.
 */
export function ParentPortalDocuments() {
  const { teamId, linkedPlayerId, parentUserId } = useParentPortal()
  const [playerDocs, setPlayerDocs] = useState<PlayerDocRow[]>([])
  const [teamDocs, setTeamDocs] = useState<TeamDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<{ canUpload?: boolean; canDelete?: boolean }>({})
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [docType, setDocType] = useState<DocumentType>("other")
  const [consent, setConsent] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const reload = useCallback(async () => {
    if (!teamId || !linkedPlayerId) return
    setLoading(true)
    try {
      const [pdRes, tdRes] = await Promise.all([
        fetch(`/api/player-documents?teamId=${encodeURIComponent(teamId)}&playerId=${encodeURIComponent(linkedPlayerId)}`),
        fetch(`/api/documents?teamId=${encodeURIComponent(teamId)}`),
      ])
      if (pdRes.ok) {
        const j = (await pdRes.json()) as {
          documents?: PlayerDocRow[]
          access?: { canUpload?: boolean; canDelete?: boolean }
        }
        setPlayerDocs(Array.isArray(j.documents) ? j.documents : [])
        setAccess(j.access ?? {})
      } else {
        setPlayerDocs([])
      }
      if (tdRes.ok) {
        const td = (await tdRes.json()) as TeamDocRow[]
        setTeamDocs(Array.isArray(td) ? td : [])
      } else {
        setTeamDocs([])
      }
    } finally {
      setLoading(false)
    }
  }, [teamId, linkedPlayerId])

  useEffect(() => {
    void reload()
  }, [reload])

  const myDocs = useMemo(
    () => playerDocs.filter((d) => visibleToPlayerDoc(d) && isMyDocumentForParent(parentUserId, d)),
    [playerDocs, parentUserId]
  )

  const sharedPlayerDocs = useMemo(
    () => playerDocs.filter((d) => visibleToPlayerDoc(d) && !isMyDocumentForParent(parentUserId, d)),
    [playerDocs, parentUserId]
  )

  const handleUpload = async () => {
    if (!teamId || !linkedPlayerId || !file || !consent) {
      setUploadErr(!consent ? "Please confirm consent to upload." : "Choose a file.")
      return
    }
    setUploadBusy(true)
    setUploadErr(null)
    try {
      const fd = new FormData()
      fd.append("teamId", teamId)
      fd.append("playerId", linkedPlayerId)
      fd.append("title", title.trim() || "Document")
      fd.append("documentType", docType)
      fd.append("seasonLabel", "")
      fd.append("notes", "")
      fd.append("retentionDays", String(DEFAULT_RETENTION_DAYS))
      fd.append("consent", "true")
      fd.append("file", file)
      const res = await fetch("/api/player-documents/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Upload failed")
      }
      setTitle("")
      setFile(null)
      setConsent(false)
      await reload()
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploadBusy(false)
    }
  }

  const openSignedPlayerDoc = async (docId: string, intent: "view" | "download") => {
    if (!teamId || !linkedPlayerId) return
    const res = await fetch(
      `/api/player-documents/${encodeURIComponent(docId)}/signed-url?teamId=${encodeURIComponent(teamId)}&playerId=${encodeURIComponent(linkedPlayerId)}&intent=${intent}`,
      { method: "POST" }
    )
    if (!res.ok) return
    const j = (await res.json()) as { url?: string }
    if (j.url) window.open(j.url, "_blank", "noopener,noreferrer")
  }

  const softDelete = async (docId: string) => {
    if (!teamId || !linkedPlayerId) return
    if (!window.confirm("Delete this document from your uploads?")) return
    const res = await fetch(
      `/api/player-documents/${encodeURIComponent(docId)}?teamId=${encodeURIComponent(teamId)}&playerId=${encodeURIComponent(linkedPlayerId)}`,
      { method: "DELETE" }
    )
    if (res.ok) void reload()
  }

  if (!linkedPlayerId) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" aria-hidden />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">My documents</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{PLAYER_DOCUMENT_UPLOAD_HELPER}</p>

        {access.canUpload !== false ? (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Physical form" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Type</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={docType}
                  onChange={(e) =>
                    setDocType(isPlayerDocumentType(e.target.value) ? e.target.value : "other")
                  }
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DOCUMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">File</Label>
              <Input type="file" className="mt-1 cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>{PLAYER_DOCUMENT_CONSENT_TEXT}</span>
            </label>
            {uploadErr ? <p className="text-xs font-medium text-red-600">{uploadErr}</p> : null}
            <Button
              type="button"
              className="w-full bg-slate-900 font-semibold text-white hover:bg-slate-800 sm:w-auto"
              disabled={uploadBusy || !file || !consent}
              onClick={() => void handleUpload()}
            >
              {uploadBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Upload
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Uploads are disabled for your account.</p>
        )}

        <DocList
          loading={loading}
          emptyHint="No personal uploads yet."
          items={myDocs.map((d) => ({
            key: d.id,
            primary: d.title || d.fileName,
            secondary: `${formatDate(d.createdAt)} · ${d.uploadedBy ? `Uploaded by ${d.uploadedBy}` : "You"}`,
            actions: (
              <>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void openSignedPlayerDoc(d.id, "view")}>
                  <Download className="h-3.5 w-3.5" /> Open
                </Button>
                {access.canDelete !== false ? (
                  <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => void softDelete(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </>
            ),
          }))}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Shared with you</h3>
        <p className="mt-1 text-xs text-slate-600">Forms and files linked to your athlete&apos;s folder.</p>
        <DocList
          loading={loading}
          emptyHint="Nothing shared yet."
          items={sharedPlayerDocs.map((d) => ({
            key: d.id,
            primary: d.title || d.fileName,
            secondary: `${formatDate(d.createdAt)} · ${d.uploadedBy ? `From ${d.uploadedBy}` : "Staff"}`,
            actions: (
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void openSignedPlayerDoc(d.id, "view")}>
                <Download className="h-3.5 w-3.5" /> View
              </Button>
            ),
          }))}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Team documents</h3>
        <p className="mt-1 text-xs text-slate-600">Coach-published files — view and download only.</p>
        <DocList
          loading={loading}
          emptyHint="No team files visible to you yet."
          items={teamDocs.map((d) => ({
            key: d.id,
            primary: d.title || d.fileName,
            secondary: `${d.category} · ${d.creator?.name || d.creator?.email || "Coach"}`,
            actions: (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => window.open(`/api/documents/${encodeURIComponent(d.id)}`, "_blank", "noopener,noreferrer")}
              >
                <Download className="h-3.5 w-3.5" /> Open
              </Button>
            ),
          }))}
        />
      </section>
    </div>
  )
}

function visibleToPlayerDoc(d: PlayerDocRow): boolean {
  return d.visibleToPlayer !== false
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return iso
  }
}

function DocList({
  loading,
  emptyHint,
  items,
}: {
  loading: boolean
  emptyHint: string
  items: Array<{ key: string; primary: string; secondary: string; actions: React.ReactNode }>
}) {
  if (loading) {
    return (
      <div className="mt-4 flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden />
        {emptyHint}
      </div>
    )
  }
  return (
    <ul className="mt-4 space-y-2">
      {items.map((row) => (
        <li
          key={row.key}
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3",
            "sm:flex-nowrap"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{row.primary}</p>
            <p className="truncate text-xs text-slate-500">{row.secondary}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">{row.actions}</div>
        </li>
      ))}
    </ul>
  )
}
