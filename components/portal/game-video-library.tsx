"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { VideoEntitlementSummary } from "@/lib/app/app-bootstrap-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Loader2, Trash2, Scissors, Sparkles } from "lucide-react"

type GameVideoRow = {
  id: string
  title: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  duration_seconds?: number | null
  upload_status?: string | null
  processing_status?: string | null
  created_at?: string | null
}

type ClipRow = {
  id: string
  start_ms: number
  end_ms: number
  duration_ms?: number | null
  title?: string | null
  description?: string | null
  tags?: string[] | null
  share_token?: string | null
}

type UploadUiState = {
  phase: "preparing" | "uploading" | "finalizing" | "success"
  /** 0–100 for bar + label */
  pct: number
  fileName: string
}

function uploadPhaseLabel(phase: UploadUiState["phase"]): string {
  switch (phase) {
    case "preparing":
      return "Preparing upload…"
    case "uploading":
      return "Uploading to storage…"
    case "finalizing":
      return "Finishing upload…"
    case "success":
      return "Upload complete"
    default:
      return "Working…"
  }
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

export function GameVideoLibrary({
  teamId,
  entitlement,
  canUpload,
  canCreateClips,
  canDeleteVideo,
  aiVideoEnabled,
  taggingEnabled,
}: {
  teamId: string
  entitlement?: VideoEntitlementSummary
  canUpload: boolean
  canCreateClips: boolean
  canDeleteVideo: boolean
  aiVideoEnabled: boolean
  taggingEnabled: boolean
}) {
  const [videos, setVideos] = useState<GameVideoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [clips, setClips] = useState<ClipRow[]>([])
  const [clipStart, setClipStart] = useState("")
  const [clipEnd, setClipEnd] = useState("")
  const [clipTitle, setClipTitle] = useState("")
  const [clipDescription, setClipDescription] = useState("")
  const [clipTags, setClipTags] = useState("")
  const [clipSaving, setClipSaving] = useState(false)
  const [uploadUi, setUploadUi] = useState<UploadUiState | null>(null)
  const uploadSuccessClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const clearUploadSuccessTimer = useCallback(() => {
    if (uploadSuccessClearRef.current != null) {
      clearTimeout(uploadSuccessClearRef.current)
      uploadSuccessClearRef.current = null
    }
  }, [])

  const selected = useMemo(() => videos.find((v) => v.id === selectedId) ?? null, [videos, selectedId])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load videos")
      setVideos(data.videos ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => () => clearUploadSuccessTimer(), [clearUploadSuccessTimer])

  const loadPlayback = useCallback(
    async (videoId: string) => {
      setPlaybackUrl(null)
      try {
        const res = await fetch(`/api/teams/${teamId}/game-videos/${videoId}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to load video")
        setPlaybackUrl(typeof data.playbackUrl === "string" ? data.playbackUrl : null)
      } catch {
        setPlaybackUrl(null)
      }
    },
    [teamId]
  )

  useEffect(() => {
    if (selectedId) void loadPlayback(selectedId)
  }, [selectedId, loadPlayback])

  const loadClips = useCallback(
    async (videoId: string) => {
      try {
        const res = await fetch(`/api/teams/${teamId}/game-videos/${videoId}/clips`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to load clips")
        setClips(data.clips ?? [])
      } catch {
        setClips([])
      }
    },
    [teamId]
  )

  useEffect(() => {
    if (selectedId) void loadClips(selectedId)
  }, [selectedId, loadClips])

  const onUseCurrentTime = (which: "start" | "end") => {
    const el = videoRef.current
    if (!el) return
    const ms = Math.floor(el.currentTime * 1000)
    if (which === "start") setClipStart(String(ms))
    else setClipEnd(String(ms))
  }

  const runAiSuggest = async () => {
    if (!aiVideoEnabled) return
    const notes = clipDescription.trim() || clipTitle.trim()
    if (!notes) return
    setClipSaving(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/video-clips/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          transcript: "",
          existingTitle: clipTitle || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "AI suggestion failed")
      if (data.suggestedTitle) setClipTitle(data.suggestedTitle)
      if (data.suggestedDescription) setClipDescription(data.suggestedDescription)
      if (Array.isArray(data.suggestedTags) && data.suggestedTags.length && taggingEnabled) {
        setClipTags(data.suggestedTags.join(", "))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI failed")
    } finally {
      setClipSaving(false)
    }
  }

  const saveClip = async () => {
    if (!selectedId || !canCreateClips) return
    const startMs = Number(clipStart)
    const endMs = Number(clipEnd)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      setError("Set valid start/end times in milliseconds (use Current buttons while playing).")
      return
    }
    setClipSaving(true)
    setError(null)
    try {
      const tags =
        taggingEnabled && clipTags.trim()
          ? clipTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : []
      const res = await fetch(`/api/teams/${teamId}/game-videos/${selectedId}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startMs,
          endMs,
          title: clipTitle.trim() || "Clip",
          description: clipDescription.trim() || null,
          tags,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not save clip")
      await loadClips(selectedId)
      setClipTitle("")
      setClipDescription("")
      setClipTags("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clip save failed")
    } finally {
      setClipSaving(false)
    }
  }

  const deleteClip = async (clipId: string) => {
    if (!selectedId) return
    if (!confirm("Delete this clip?")) return
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos/${selectedId}/clips/${clipId}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      await loadClips(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const deleteVideo = async (videoId: string) => {
    if (!canDeleteVideo) return
    if (!confirm("Delete this game video from storage?")) return
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos/${videoId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      if (selectedId === videoId) {
        setSelectedId(null)
        setPlaybackUrl(null)
      }
      await loadList()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const onUploadFile = async (file: File) => {
    if (!canUpload) return
    clearUploadSuccessTimer()
    setError(null)
    setUploadUi({ phase: "preparing", pct: 0, fileName: file.name })
    try {
      const initRes = await fetch(`/api/teams/${teamId}/game-videos/upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          title: file.name,
          multipart: file.size > 100 * 1024 * 1024,
        }),
      })
      const init = await initRes.json().catch(() => ({}))
      if (!initRes.ok) throw new Error(init.error || "Upload init failed")

      if (init.mode === "single_put" && init.uploadUrl) {
        setUploadUi({ phase: "uploading", pct: 0, fileName: file.name })
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open("PUT", init.uploadUrl)
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && ev.total > 0) {
              const pct = Math.round((ev.loaded / ev.total) * 100)
              setUploadUi({ phase: "uploading", pct, fileName: file.name })
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve()
            else reject(new Error(`Upload failed (${xhr.status})`))
          }
          xhr.onerror = () => reject(new Error("Network error during upload"))
          xhr.send(file)
        })

        const vid = init.videoId as string
        let durationSeconds: number | null = null
        try {
          durationSeconds = await readDurationFromFile(file)
        } catch {
          durationSeconds = null
        }

        setUploadUi({ phase: "finalizing", pct: 100, fileName: file.name })
        const compRes = await fetch(`/api/teams/${teamId}/game-videos/upload/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: vid,
            mode: "single_put",
            durationSeconds,
          }),
        })
        const comp = await compRes.json().catch(() => ({}))
        if (!compRes.ok) throw new Error(comp.error || "Complete failed")
        await loadList()
        setSelectedId(vid)
        setUploadUi({ phase: "success", pct: 100, fileName: file.name })
        clearUploadSuccessTimer()
        uploadSuccessClearRef.current = setTimeout(() => {
          setUploadUi(null)
          uploadSuccessClearRef.current = null
        }, 2800)
        return
      }

      if (init.mode === "multipart" && init.uploadId && init.videoId && init.partSizeBytes) {
        const partSize: number = init.partSizeBytes
        const totalParts: number = Math.ceil(file.size / partSize)
        const parts: Array<{ partNumber: number; etag: string }> = []

        setUploadUi({ phase: "uploading", pct: 0, fileName: file.name })

        for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
          const start = (partNumber - 1) * partSize
          const blob = file.slice(start, start + partSize)
          const urlRes = await fetch(`/api/teams/${teamId}/game-videos/upload/multipart/part-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoId: init.videoId,
              uploadId: init.uploadId,
              partNumber,
            }),
          })
          const urlData = await urlRes.json().catch(() => ({}))
          if (!urlRes.ok) throw new Error(urlData.error || "Part URL failed")

          const xhr = new XMLHttpRequest()
          await new Promise<void>((resolve, reject) => {
            xhr.open("PUT", urlData.uploadUrl)
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable && ev.total > 0 && totalParts > 0) {
                const base = (partNumber - 1) / totalParts
                const frac = ev.loaded / ev.total / totalParts
                const overall = Math.min(100, Math.round((base + frac) * 100))
                setUploadUi({ phase: "uploading", pct: overall, fileName: file.name })
              }
            }
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve()
              else reject(new Error(`Part ${partNumber} upload failed (${xhr.status})`))
            }
            xhr.onerror = () => reject(new Error(`Network error on part ${partNumber}`))
            xhr.send(blob)
          })

          const etagHeader = xhr.getResponseHeader("etag") || xhr.getResponseHeader("ETag")
          if (!etagHeader) throw new Error(`Missing ETag for part ${partNumber}`)
          const clean = etagHeader.replace(/^"|"$/g, "")
          parts.push({ partNumber, etag: clean })
        }

        let durationSeconds: number | null = null
        try {
          durationSeconds = await readDurationFromFile(file)
        } catch {
          durationSeconds = null
        }

        setUploadUi({ phase: "finalizing", pct: 100, fileName: file.name })
        const compRes = await fetch(`/api/teams/${teamId}/game-videos/upload/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: init.videoId,
            mode: "multipart",
            uploadId: init.uploadId,
            parts,
            durationSeconds,
          }),
        })
        const comp = await compRes.json().catch(() => ({}))
        if (!compRes.ok) throw new Error(comp.error || "Complete failed")
        await loadList()
        setSelectedId(init.videoId as string)
        setUploadUi({ phase: "success", pct: 100, fileName: file.name })
        clearUploadSuccessTimer()
        uploadSuccessClearRef.current = setTimeout(() => {
          setUploadUi(null)
          uploadSuccessClearRef.current = null
        }, 2800)
        return
      }

      throw new Error("Unexpected upload response")
    } catch (e) {
      clearUploadSuccessTimer()
      setError(e instanceof Error ? e.message : "Upload failed")
      setUploadUi(null)
    }
  }

  return (
    <div className="space-y-8">
      {entitlement && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Storage</span>{" "}
          <span className="font-mono text-xs">
            {formatBytes(entitlement.storageUsedBytes)} / {formatBytes(entitlement.storageCapBytes)}
          </span>
          <span className="mx-2 text-border">·</span>
          <span>
            Videos {entitlement.videoCount} · Clips {entitlement.clipCount}
          </span>
          {entitlement.sharedStorageScope === "program" && (
            <>
              <span className="mx-2 text-border">·</span>
              <span>Program-shared quota</span>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Library</h2>
            {canUpload && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ""
                    if (f) void onUploadFile(f)
                  }}
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={
                    !!uploadUi &&
                    (uploadUi.phase === "preparing" ||
                      uploadUi.phase === "uploading" ||
                      uploadUi.phase === "finalizing")
                  }
                  onClick={() => fileRef.current?.click()}
                >
                  Upload video
                </Button>
              </>
            )}
          </div>
          {uploadUi && (
            <div
              className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
              role="status"
              aria-live="polite"
              aria-valuenow={uploadUi.pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  {uploadUi.phase === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                  )}
                  <span className="font-medium text-foreground">{uploadPhaseLabel(uploadUi.phase)}</span>
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{uploadUi.pct}%</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground" title={uploadUi.fileName}>
                {uploadUi.fileName}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ease-out ${
                    uploadUi.phase === "success"
                      ? "bg-emerald-600 dark:bg-emerald-500"
                      : "bg-[#2563EB]"
                  }`}
                  style={{ width: `${uploadUi.pct}%` }}
                />
              </div>
            </div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No videos yet.</p>
          ) : (
            <ul className="space-y-2">
              {videos.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === v.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <span className="line-clamp-2 font-medium text-foreground">{v.title || "Untitled"}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {v.upload_status === "ready" ? "Ready" : v.upload_status ?? ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Player</h2>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a video to play.</p>
          ) : (
            <>
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
                {playbackUrl ? (
                  <video
                    ref={videoRef}
                    key={playbackUrl}
                    className="h-full w-full"
                    controls
                    src={playbackUrl}
                    preload="metadata"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Preparing playback…
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {selected.file_size_bytes != null && <span>{formatBytes(selected.file_size_bytes)}</span>}
                {selected.duration_seconds != null && (
                  <span>{Math.round(selected.duration_seconds)}s duration</span>
                )}
              </div>
              {canDeleteVideo && (
                <Button type="button" variant="outline" size="sm" onClick={() => void deleteVideo(selected.id)}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                  Delete video
                </Button>
              )}

              {canCreateClips && selected.upload_status === "ready" && (
                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Scissors className="h-4 w-4" aria-hidden />
                    Create clip
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Start (ms)</label>
                      <div className="flex gap-2">
                        <Input value={clipStart} onChange={(e) => setClipStart(e.target.value)} placeholder="e.g. 12000" />
                        <Button type="button" variant="secondary" size="sm" onClick={() => onUseCurrentTime("start")}>
                          Current
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">End (ms)</label>
                      <div className="flex gap-2">
                        <Input value={clipEnd} onChange={(e) => setClipEnd(e.target.value)} placeholder="e.g. 45000" />
                        <Button type="button" variant="secondary" size="sm" onClick={() => onUseCurrentTime("end")}>
                          Current
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Title</label>
                    <Input value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} placeholder="Clip title" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Notes (for AI assist)</label>
                    <textarea
                      className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={clipDescription}
                      onChange={(e) => setClipDescription(e.target.value)}
                      placeholder="What happens on this clip — used for AI title/description suggestions."
                    />
                  </div>
                  {taggingEnabled && (
                    <div>
                      <label className="text-xs text-muted-foreground">Tags (comma-separated)</label>
                      <Input
                        value={clipTags}
                        onChange={(e) => setClipTags(e.target.value)}
                        placeholder="redzone, third down, …"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void saveClip()} disabled={clipSaving}>
                      {clipSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save clip
                    </Button>
                    {aiVideoEnabled && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => void runAiSuggest()} disabled={clipSaving}>
                        <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                        AI suggest
                      </Button>
                    )}
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Saved clips</p>
                    {clips.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {clips.map((c) => (
                          <li
                            key={c.id}
                            className="flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <div className="font-medium text-foreground">{c.title || "Clip"}</div>
                              <div className="text-xs text-muted-foreground">
                                {c.start_ms}–{c.end_ms} ms
                                {c.share_token && (
                                  <span className="ml-2 font-mono">
                                    Ref: {c.share_token.slice(0, 8)}…
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => void deleteClip(c.id)}>
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function readDurationFromFile(file: File): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement("video")
    v.preload = "metadata"
    v.src = url
    v.onloadedmetadata = () => {
      const d = v.duration
      URL.revokeObjectURL(url)
      if (Number.isFinite(d) && d > 0) resolve(Math.round(d))
      else resolve(null)
    }
    v.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("metadata"))
    }
  })
}
