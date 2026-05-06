"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Trash2, Download, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"
import { cn } from "@/lib/utils"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  PLAYER_DOCUMENT_CONSENT_TEXT,
  PLAYER_DOCUMENT_UPLOAD_HELPER,
  DEFAULT_RETENTION_DAYS,
  type DocumentType,
  isPlayerDocumentType,
} from "@/lib/player-documents/constants"
import {
  PORTAL_DOCUMENTS_MY_TITLE,
  PORTAL_DOCUMENTS_STAFF_FOLDER_SUBTITLE,
  PORTAL_DOCUMENTS_STAFF_FOLDER_TITLE,
  PORTAL_DOCUMENTS_TEAM_LIBRARY_SUBTITLE,
  PORTAL_DOCUMENTS_TEAM_LIBRARY_TITLE,
  PORTAL_DOCUMENTS_EMPTY_STAFF_FOLDER,
  PORTAL_DOCUMENTS_EMPTY_TEAM_LIBRARY,
} from "@/lib/player-documents/portal-documents-section-copy"

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

function isMyPlayerDocument(userId: string, d: PlayerDocRow): boolean {
  return d.uploadedByProfileId === userId || d.createdByUserId === userId
}

export function PlayerPortalDocuments() {
  const { teamId, playerId, playerIdLoading, userId } = usePlayerPortal()
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
    if (!teamId || !playerId) return
    setLoading(true)
    try {
      const [pdRes, tdRes] = await Promise.all([
        fetch(`/api/player-documents?teamId=${encodeURIComponent(teamId)}&playerId=${encodeURIComponent(playerId)}`),
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
  }, [teamId, playerId])

  useEffect(() => {
    void reload()
  }, [reload])

  const myDocs = useMemo(
    () => playerDocs.filter((d) => visibleToPlayerDoc(d) && isMyPlayerDocument(userId, d)),
    [playerDocs, userId]
  )

  const sharedPlayerDocs = useMemo(
    () =>
      playerDocs.filter((d) => visibleToPlayerDoc(d) && !isMyPlayerDocument(userId, d)),
    [playerDocs, userId]
  )

  const handleUpload = async () => {
    if (!teamId || !playerId || !file || !consent) {
      setUploadErr(!consent ? "Please confirm consent to upload." : "Choose a file.")
      return
    }
    setUploadBusy(true)
    setUploadErr(null)
    try {
      const fd = new FormData()
      fd.append("teamId", teamId)
      fd.append("playerId", playerId)
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
    if (!teamId || !playerId) return
    const res = await fetch(
      `/api/player-documents/${encodeURIComponent(docId)}/signed-url?teamId=${encodeURIComponent(teamId)}&playerId=${encodeURIComponent(playerId)}&intent=${intent}`,
      { method: "POST" }
    )
    if (!res.ok) return
    const j = (await res.json()) as { url?: string }
    if (j.url) window.open(j.url, "_blank", "noopener,noreferrer")
  }

  const softDelete = async (docId: string) => {
    if (!teamId || !playerId) return
    if (!window.confirm("Delete this document from your uploads?")) return
    const res = await fetch(
      `/api/player-documents/${encodeURIComponent(docId)}?teamId=${encodeURIComponent(teamId)}&playerId=${encodeURIComponent(playerId)}`,
      { method: "DELETE" }
    )
    if (res.ok) void reload()
  }

  if (playerIdLoading || !playerId) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-white" aria-hidden />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className={`rounded-2xl border p-5 shadow-xl ${braikPlayerTheme.surface}`}>
        <h3 className={`text-lg font-bold ${braikPlayerTheme.textWarm}`}>{PORTAL_DOCUMENTS_MY_TITLE}</h3>
        <p className={`mt-1 text-xs leading-relaxed ${braikPlayerTheme.textSecondary}`}>{PLAYER_DOCUMENT_UPLOAD_HELPER}</p>

        {access.canUpload !== false ? (
          <div className="mt-4 space-y-3 rounded-xl border border-[#2a3152] bg-[#10265f] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className={`text-xs font-semibold ${braikPlayerTheme.textSecondary}`}>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Physical form" className="mt-1" />
              </div>
              <div>
                <Label className={`text-xs font-semibold ${braikPlayerTheme.textSecondary}`}>Type</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-[#1f2f63] bg-[#F8F8F8] px-3 py-2 text-sm text-[#081838] focus:outline-none focus:ring-2 focus:ring-[#F85808]"
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
              <Label className={`text-xs font-semibold ${braikPlayerTheme.textSecondary}`}>File</Label>
              <Input type="file" className="mt-1 cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <label className={`flex cursor-pointer items-start gap-2 text-xs ${braikPlayerTheme.textSecondary}`}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>{PLAYER_DOCUMENT_CONSENT_TEXT}</span>
            </label>
            {uploadErr ? <p className="text-xs font-medium text-[#F85808]">{uploadErr}</p> : null}
            <Button
              type="button"
              className="w-full bg-gradient-to-r from-[#F85808] to-[#D83808] font-semibold text-[#F8F8F8] hover:brightness-105 sm:w-auto"
              disabled={uploadBusy || !file || !consent}
              onClick={() => void handleUpload()}
            >
              {uploadBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Upload
            </Button>
          </div>
        ) : (
          <p className={`mt-3 text-sm ${braikPlayerTheme.textMuted}`}>Uploads are disabled for your account.</p>
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

      <section className={`rounded-2xl border p-5 shadow-xl ${braikPlayerTheme.surface}`}>
        <h3 className={`text-lg font-bold ${braikPlayerTheme.textWarm}`}>{PORTAL_DOCUMENTS_STAFF_FOLDER_TITLE}</h3>
        <p className={`mt-1 text-xs ${braikPlayerTheme.textSecondary}`}>{PORTAL_DOCUMENTS_STAFF_FOLDER_SUBTITLE}</p>
        <DocList
          loading={loading}
          emptyHint={PORTAL_DOCUMENTS_EMPTY_STAFF_FOLDER}
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

      <section className={`rounded-2xl border p-5 shadow-xl ${braikPlayerTheme.surface}`}>
        <h3 className={`text-lg font-bold ${braikPlayerTheme.textWarm}`}>{PORTAL_DOCUMENTS_TEAM_LIBRARY_TITLE}</h3>
        <p className={`mt-1 text-xs ${braikPlayerTheme.textSecondary}`}>{PORTAL_DOCUMENTS_TEAM_LIBRARY_SUBTITLE}</p>
        <DocList
          loading={loading}
          emptyHint={PORTAL_DOCUMENTS_EMPTY_TEAM_LIBRARY}
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
        <Loader2 className="h-8 w-8 animate-spin text-[#F85808]" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-[#2a3152] bg-[#10265f] px-4 py-8 text-center text-sm text-[#9aa8c7]">
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
            "border-[#2a3152] bg-[#10265f]",
            "sm:flex-nowrap"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#F8F8E8]">{row.primary}</p>
            <p className="truncate text-xs text-[#9aa8c7]">{row.secondary}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">{row.actions}</div>
        </li>
      ))}
    </ul>
  )
}
