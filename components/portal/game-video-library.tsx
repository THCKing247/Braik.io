"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
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
    <div className="space-y-6">
      {entitlement && (
        <details className="group rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-xs text-muted-foreground shadow-sm open:bg-card open:shadow-md">
          <summary className="cursor-pointer list-none font-medium text-foreground outline-none marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="underline-offset-2 group-open:no-underline">
              Video space for this team — {formatBytes(entitlement.storageUsedBytes)} of {formatBytes(entitlement.storageCapBytes)}{" "}
              used
            </span>
            <span className="ml-2 inline text-muted-foreground">
              ({entitlement.videoCount} films, {entitlement.clipCount} clips stored)
              {entitlement.sharedStorageScope === "program" ? " · Program-shared" : ""}
            </span>
          </summary>
          <p className="mt-2 border-t border-border pt-2 text-[11px] leading-relaxed">
            Storage keeps your uploads safe; day-to-day work happens in the film viewer and clip reel below.
          </p>
        </details>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-start lg:gap-8">
        <MediaLibraryRail
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

        <div className="min-w-0">
          {!selected ? (
            <div className="flex min-h-[440px] flex-col justify-center rounded-2xl border border-dashed border-border bg-gradient-to-b from-card to-muted/20 px-6 py-12 text-left sm:px-10">
              <p className="text-lg font-semibold text-foreground">Open a film to start</p>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Your game or practice film opens in the main workspace with a scrubber, mark buttons, and tabs for notes and
                tags.
              </p>
              <ol className="mt-8 max-w-md list-decimal space-y-3 pl-5 text-sm text-foreground">
                <li>
                  <span className="font-medium">Upload</span>{" "}
                  <span className="text-muted-foreground">— add video from the left if you haven’t yet.</span>
                </li>
                <li>
                  <span className="font-medium">Pick the film</span>{" "}
                  <span className="text-muted-foreground">— click it in the library when it’s Ready.</span>
                </li>
                <li>
                  <span className="font-medium">Watch and mark</span>{" "}
                  <span className="text-muted-foreground">— set start and end on the play you’re teaching.</span>
                </li>
                <li>
                  <span className="font-medium">Save &amp; organize</span>{" "}
                  <span className="text-muted-foreground">— add tags or notes, then star clips for your teaching reel.</span>
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
