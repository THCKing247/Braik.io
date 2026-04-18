"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { VideoEntitlementSummary } from "@/lib/app/app-bootstrap-types"
import { FilmWorkspace } from "@/components/portal/game-video/film-workspace"
import { MediaLibraryRail } from "@/components/portal/game-video/media-library-rail"
import type { ClipRow, GameVideoRow, UploadUiState } from "@/components/portal/game-video/game-video-types"
import { formatBytes } from "@/components/portal/game-video/format-bytes"

export function GameVideoLibrary({
  teamId,
  entitlement,
  canUpload,
  canCreateClips,
  canDeleteVideo,
  aiVideoEnabled,
  taggingEnabled,
  embeddedInModal = false,
}: {
  teamId: string
  entitlement?: VideoEntitlementSummary
  canUpload: boolean
  canCreateClips: boolean
  canDeleteVideo: boolean
  aiVideoEnabled: boolean
  taggingEnabled: boolean
  /** Full-screen film room overlay — tighter layout and higher-contrast copy */
  embeddedInModal?: boolean
}) {
  const [videos, setVideos] = useState<GameVideoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)

  const [clips, setClips] = useState<ClipRow[]>([])
  const [uploadUi, setUploadUi] = useState<UploadUiState | null>(null)
  const uploadSuccessClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const clearUploadSuccessTimer = useCallback(() => {
    if (uploadSuccessClearRef.current != null) {
      clearTimeout(uploadSuccessClearRef.current)
      uploadSuccessClearRef.current = null
    }
  }, [])

  const selected = videos.find((v) => v.id === selectedId) ?? null

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

  const refreshClips = useCallback(async () => {
    if (selectedId) await loadClips(selectedId)
  }, [selectedId, loadClips])

  const deleteVideo = async () => {
    if (!selectedId || !canDeleteVideo) return
    if (!confirm("Delete this game video from storage? All clips on this film will be removed.")) return
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos/${selectedId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      setSelectedId(null)
      setPlaybackUrl(null)
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
    <div
      className={cn(
        "flex flex-col gap-6",
        embeddedInModal && "min-h-0 flex-1",
      )}
    >
      {entitlement && (
        <details
          className={cn(
            "group rounded-2xl border px-4 py-3 shadow-sm open:shadow-md",
            embeddedInModal
              ? "border-white/15 bg-white/[0.07] text-sm text-slate-200 open:bg-white/[0.09]"
              : "border-border/80 bg-muted/20 text-xs text-muted-foreground open:bg-card",
          )}
        >
          <summary className="cursor-pointer list-none font-semibold text-foreground outline-none marker:hidden [&::-webkit-details-marker]:hidden">
            <span className={cn(embeddedInModal && "text-white")}>Video space for this team — {formatBytes(entitlement.storageUsedBytes)} of {formatBytes(entitlement.storageCapBytes)}{" "}
              used</span>
            <span className={cn("ml-2 inline", embeddedInModal ? "text-slate-300" : "text-muted-foreground")}>
              ({entitlement.videoCount} films, {entitlement.clipCount} clips stored)
              {entitlement.sharedStorageScope === "program" ? " · Program-shared" : ""}
            </span>
          </summary>
          <p
            className={cn(
              "mt-2 border-t pt-2 text-[13px] leading-relaxed",
              embeddedInModal ? "border-white/10 text-slate-300" : "border-border text-[11px] text-muted-foreground",
            )}
          >
            Storage keeps your uploads safe; your film work is in the viewer and saved clips below.
          </p>
        </details>
      )}

      {error && (
        <div
          className={cn(
            "rounded-xl border border-destructive/50 bg-destructive/15 px-4 py-3 text-destructive",
            embeddedInModal && "text-base font-medium",
          )}
        >
          {error}
        </div>
      )}

      <div
        className={cn(
          "grid min-h-0 gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:items-stretch lg:gap-8",
          embeddedInModal && "flex-1",
        )}
      >
        <MediaLibraryRail
          filmRoom={embeddedInModal}
          videos={videos}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          canUpload={canUpload}
          uploadUi={uploadUi}
          fileInputRef={fileRef as React.RefObject<HTMLInputElement>}
          onPickUpload={() => fileRef.current?.click()}
          onFileSelected={(f) => void onUploadFile(f)}
        />

        <div className="flex min-h-0 min-w-0 flex-col">
          {!selected ? (
            <div
              className={cn(
                "flex flex-col justify-center rounded-2xl border border-dashed px-6 py-12 text-left sm:px-10",
                embeddedInModal
                  ? "min-h-[min(520px,calc(100dvh-16rem))] border-white/20 bg-white/[0.06] text-slate-100"
                  : "min-h-[440px] border-border bg-gradient-to-b from-card to-muted/20 text-foreground",
              )}
            >
              <p className={cn("text-xl font-bold", embeddedInModal && "text-white")}>Open a film to start</p>
              <p
                className={cn(
                  "mt-3 max-w-lg text-[15px] leading-relaxed",
                  embeddedInModal ? "text-slate-300" : "text-muted-foreground",
                )}
              >
                Pick a video from the film library on the left. The player opens here with mark buttons, notes, tags, and
                your saved clips.
              </p>
              <ol className="mt-8 max-w-lg list-decimal space-y-4 pl-6 text-[15px] leading-snug">
                <li className={cn(embeddedInModal ? "text-white" : "text-foreground")}>
                  <span className="font-semibold">Upload video</span>{" "}
                  <span className={embeddedInModal ? "text-slate-400" : "text-muted-foreground"}>
                    — use the blue button on the left if you need new film.
                  </span>
                </li>
                <li className={cn(embeddedInModal ? "text-white" : "text-foreground")}>
                  <span className="font-semibold">Select your game or practice</span>{" "}
                  <span className={embeddedInModal ? "text-slate-400" : "text-muted-foreground"}>
                    — wait until it shows Ready.
                  </span>
                </li>
                <li className={cn(embeddedInModal ? "text-white" : "text-foreground")}>
                  <span className="font-semibold">Mark start and end</span>{" "}
                  <span className={embeddedInModal ? "text-slate-400" : "text-muted-foreground"}>
                    — on the play you’re coaching up.
                  </span>
                </li>
                <li className={cn(embeddedInModal ? "text-white" : "text-foreground")}>
                  <span className="font-semibold">Save clip and tag it</span>{" "}
                  <span className={embeddedInModal ? "text-slate-400" : "text-muted-foreground"}>
                    — build your teaching reel on the Saved clips tab.
                  </span>
                </li>
              </ol>
            </div>
          ) : (
            <FilmWorkspace
              teamId={teamId}
              video={selected}
              playbackUrl={playbackUrl}
              clips={clips}
              onRefreshClips={refreshClips}
              canCreateClips={canCreateClips}
              canDeleteVideo={canDeleteVideo}
              aiVideoEnabled={aiVideoEnabled}
              taggingEnabled={taggingEnabled}
              onError={setError}
              onDeleteVideo={deleteVideo}
            />
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
