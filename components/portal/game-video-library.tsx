"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { VideoEntitlementSummary } from "@/lib/app/app-bootstrap-types"
import { FilmLibraryBrowse } from "@/components/portal/game-video/film-library-browse"
import { FilmRoomModalShell } from "@/components/portal/game-video/film-room-modal-shell"
import { FilmWorkspace } from "@/components/portal/game-video/film-workspace"
import { Button } from "@/components/ui/button"
import type {
  ClipLibraryRow,
  ClipRow,
  FilmUploadMeta,
  GameVideoRow,
  UploadUiState,
} from "@/components/portal/game-video/game-video-types"
import { defaultDisplayTitleFromFileName } from "@/lib/video/upload-display-title"

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
  const [loadingVideos, setLoadingVideos] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [allClips, setAllClips] = useState<ClipLibraryRow[]>([])
  const [loadingClips, setLoadingClips] = useState(false)

  const [filmRoomVideoId, setFilmRoomVideoId] = useState<string | null>(null)
  const [filmRoomClipId, setFilmRoomClipId] = useState<string | null>(null)

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [modalClips, setModalClips] = useState<ClipRow[]>([])
  const [filmAttachedPlayerIds, setFilmAttachedPlayerIds] = useState<string[]>([])

  const [uploadUi, setUploadUi] = useState<UploadUiState | null>(null)
  const [privacyBusyKey, setPrivacyBusyKey] = useState<string | null>(null)
  const uploadSuccessClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearUploadSuccessTimer = useCallback(() => {
    if (uploadSuccessClearRef.current != null) {
      clearTimeout(uploadSuccessClearRef.current)
      uploadSuccessClearRef.current = null
    }
  }, [])

  const modalVideo = videos.find((v) => v.id === filmRoomVideoId) ?? null

  const loadList = useCallback(async () => {
    setLoadingVideos(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load videos")
      setVideos(data.videos ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoadingVideos(false)
    }
  }, [teamId])

  const loadAllClips = useCallback(
    async (videoList: GameVideoRow[]) => {
      if (videoList.length === 0) {
        setAllClips([])
        return
      }
      setLoadingClips(true)
      try {
        const batches = await Promise.all(
          videoList.map(async (v) => {
            const res = await fetch(`/api/teams/${teamId}/game-videos/${v.id}/clips`)
            const data = await res.json().catch(() => ({}))
            if (!res.ok) return [] as ClipLibraryRow[]
            const raw = data.clips ?? []
            return (raw as unknown[]).map((row) => normalizeClipRow(row, v))
          }),
        )
        setAllClips(batches.flat())
      } finally {
        setLoadingClips(false)
      }
    },
    [teamId],
  )

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    void loadAllClips(videos)
  }, [videos, loadAllClips])

  useEffect(() => () => clearUploadSuccessTimer(), [clearUploadSuccessTimer])

  const loadPlayback = useCallback(
    async (videoId: string) => {
      setPlaybackUrl(null)
      setFilmAttachedPlayerIds([])
      try {
        const res = await fetch(`/api/teams/${teamId}/game-videos/${videoId}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to load video")
        setPlaybackUrl(typeof data.playbackUrl === "string" ? data.playbackUrl : null)
        const raw = data.attachedPlayerIds
        const ids = Array.isArray(raw) ? raw.filter((x: unknown): x is string => typeof x === "string") : []
        setFilmAttachedPlayerIds(ids)
      } catch {
        setPlaybackUrl(null)
        setFilmAttachedPlayerIds([])
      }
    },
    [teamId],
  )

  const updateFilmAttachedPlayers = useCallback(
    async (ids: string[]) => {
      if (!filmRoomVideoId) return
      const res = await fetch(`/api/teams/${teamId}/game-videos/${filmRoomVideoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Could not update film players")
      const next = Array.isArray((data as { video?: { attachedPlayerIds?: string[] } }).video?.attachedPlayerIds)
        ? ((data as { video: { attachedPlayerIds: string[] } }).video.attachedPlayerIds)
        : ids
      setFilmAttachedPlayerIds(next)
    },
    [teamId, filmRoomVideoId],
  )

  const loadModalClips = useCallback(
    async (videoId: string) => {
      try {
        const res = await fetch(`/api/teams/${teamId}/game-videos/${videoId}/clips`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to load clips")
        const film = videos.find((v) => v.id === videoId)
        if (!film) {
          setModalClips([])
          return
        }
        const raw = data.clips ?? []
        const mapped = (raw as unknown[]).map((row) => stripToClipRow(normalizeClipRow(row, film)))
        setModalClips(mapped)
      } catch {
        setModalClips([])
      }
    },
    [teamId, videos],
  )

  useEffect(() => {
    if (!filmRoomVideoId) {
      setPlaybackUrl(null)
      setModalClips([])
      return
    }
    void loadPlayback(filmRoomVideoId)
    void loadModalClips(filmRoomVideoId)
  }, [filmRoomVideoId, loadPlayback, loadModalClips])

  const refreshClipsForWorkspace = useCallback(async () => {
    if (!filmRoomVideoId) return
    await loadModalClips(filmRoomVideoId)
    await loadAllClips(videos)
  }, [filmRoomVideoId, loadModalClips, loadAllClips, videos])

  const closeFilmRoom = useCallback(() => {
    setFilmRoomVideoId(null)
    setFilmRoomClipId(null)
    setPlaybackUrl(null)
    setModalClips([])
    setError(null)
    void loadList()
  }, [loadList])

  const openFilmRoom = useCallback((videoId: string, opts?: { clipId?: string }) => {
    setError(null)
    setFilmRoomVideoId(videoId)
    setFilmRoomClipId(opts?.clipId ?? null)
  }, [])

  const deleteFilmFromBrowse = async (v: GameVideoRow) => {
    if (!canDeleteVideo) return
    if (!confirm(`Delete “${v.title || "this film"}” from storage? All clips on this film will be removed.`)) return
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos/${v.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      if (filmRoomVideoId === v.id) closeFilmRoom()
      await loadList()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const deleteClipFromBrowse = async (c: ClipLibraryRow) => {
    if (!confirm("Remove this clip?")) return
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos/${c.game_video_id}/clips/${c.id}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      await loadList()
      if (filmRoomVideoId === c.game_video_id) await loadModalClips(c.game_video_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const patchVideoPrivacy = useCallback(
    async (videoId: string, isPrivate: boolean) => {
      setPrivacyBusyKey(`v:${videoId}`)
      setError(null)
      try {
        const res = await fetch(`/api/teams/${teamId}/game-videos/${videoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPrivate }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Update failed")
        setVideos((prev) =>
          prev.map((v) => (v.id === videoId ? { ...v, is_private: isPrivate } : v)),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed")
      } finally {
        setPrivacyBusyKey(null)
      }
    },
    [teamId],
  )

  const patchClipPrivacy = useCallback(
    async (gameVideoId: string, clipId: string, isPrivate: boolean) => {
      setPrivacyBusyKey(`c:${clipId}`)
      setError(null)
      try {
        const res = await fetch(`/api/teams/${teamId}/game-videos/${gameVideoId}/clips/${clipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPrivate }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Update failed")
        setAllClips((prev) =>
          prev.map((c) => (c.id === clipId ? { ...c, is_private: isPrivate } : c)),
        )
        setModalClips((prev) =>
          prev.map((c) => (c.id === clipId ? { ...c, is_private: isPrivate } : c)),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed")
      } finally {
        setPrivacyBusyKey(null)
      }
    },
    [teamId],
  )

  const deleteVideoInModal = async () => {
    if (!filmRoomVideoId || !modalVideo || !canDeleteVideo) return
    if (!confirm("Delete this game video from storage? All clips on this film will be removed.")) return
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos/${filmRoomVideoId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      closeFilmRoom()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const onUploadFile = async (file: File, meta: FilmUploadMeta) => {
    if (!canUpload) return
    clearUploadSuccessTimer()
    setError(null)
    const customTitle = meta.title?.trim() ?? ""
    const displayTitle = customTitle.length > 0 ? customTitle : defaultDisplayTitleFromFileName(file.name)
    setUploadUi({ phase: "preparing", pct: 0, fileName: file.name, displayTitle })
    try {
      const initPayload: Record<string, unknown> = {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        multipart: file.size > 100 * 1024 * 1024,
        isPrivate: meta.isPrivate,
      }
      if (customTitle.length > 0) initPayload.title = customTitle
      if (meta.tags && meta.tags.length > 0) initPayload.tags = meta.tags
      if (meta.opponent?.trim()) initPayload.opponent = meta.opponent.trim()
      if (meta.category?.trim()) initPayload.category = meta.category.trim()
      if (meta.gameDate?.trim()) initPayload.gameDate = meta.gameDate.trim()

      const initRes = await fetch(`/api/teams/${teamId}/game-videos/upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initPayload),
      })
      const init = await initRes.json().catch(() => ({}))
      if (!initRes.ok) throw new Error(init.error || "Upload init failed")

      if (init.mode === "single_put" && init.uploadUrl) {
        setUploadUi({ phase: "uploading", pct: 0, fileName: file.name, displayTitle })
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open("PUT", init.uploadUrl)
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && ev.total > 0) {
              const pct = Math.round((ev.loaded / ev.total) * 100)
              setUploadUi({ phase: "uploading", pct, fileName: file.name, displayTitle })
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

        setUploadUi({ phase: "finalizing", pct: 100, fileName: file.name, displayTitle })
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
        setUploadUi({ phase: "success", pct: 100, fileName: file.name, displayTitle })
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

        setUploadUi({ phase: "uploading", pct: 0, fileName: file.name, displayTitle })

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
                setUploadUi({ phase: "uploading", pct: overall, fileName: file.name, displayTitle })
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

        setUploadUi({ phase: "finalizing", pct: 100, fileName: file.name, displayTitle })
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
        setUploadUi({ phase: "success", pct: 100, fileName: file.name, displayTitle })
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
    <>
      <div className="space-y-5">
        {error && !filmRoomVideoId && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/15 px-4 py-3 text-base font-medium text-destructive">
            {error}
          </div>
        )}

        <FilmLibraryBrowse
          videos={videos}
          videosLoading={loadingVideos}
          clips={allClips}
          clipsLoading={loadingClips}
          canUpload={canUpload}
          canDeleteVideo={canDeleteVideo}
          canSetRecruitingPrivacy={canUpload || canCreateClips}
          taggingEnabled={taggingEnabled}
          entitlement={entitlement}
          uploadUi={uploadUi}
          privacyBusyKey={privacyBusyKey}
          onVideoPrivacyChange={(id, isPrivate) => void patchVideoPrivacy(id, isPrivate)}
          onClipPrivacyChange={(gameVideoId, clipId, isPrivate) =>
            void patchClipPrivacy(gameVideoId, clipId, isPrivate)
          }
          onUploadVideo={(f, meta) => void onUploadFile(f, meta)}
          onOpenFilmRoom={openFilmRoom}
          onDeleteFilm={(v) => void deleteFilmFromBrowse(v)}
          onDeleteClip={(c) => void deleteClipFromBrowse(c)}
        />
      </div>

      {filmRoomVideoId && (
        <FilmRoomModalShell onExit={closeFilmRoom} exitLabel="Back to film library">
          <div className={cn("flex min-h-0 flex-1 flex-col gap-6")}>
            {error && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/20 px-4 py-3 text-base font-medium text-red-100">
                {error}
              </div>
            )}

            {modalVideo ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <FilmWorkspace
                  teamId={teamId}
                  video={modalVideo}
                  playbackUrl={playbackUrl}
                  clips={modalClips}
                  onRefreshClips={refreshClipsForWorkspace}
                  canCreateClips={canCreateClips}
                  canDeleteVideo={canDeleteVideo}
                  aiVideoEnabled={aiVideoEnabled}
                  taggingEnabled={taggingEnabled}
                  onError={setError}
                  onDeleteVideo={deleteVideoInModal}
                  initialClipId={filmRoomClipId}
                  onSavedClipContextExit={() => setFilmRoomClipId(null)}
                  filmAttachedPlayerIds={filmAttachedPlayerIds}
                  onFilmAttachedPlayerIdsChange={updateFilmAttachedPlayers}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#0f172a]/60 px-6 py-16 text-center">
                <p className="text-lg font-semibold text-white">Film not found</p>
                <p className="max-w-md text-sm leading-relaxed text-slate-300">
                  This film may have been removed or is still loading. Go back to the library and open a film from your list.
                </p>
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  className="mt-2 h-12 min-h-[48px] border-2 border-white/25 bg-white px-6 text-base font-bold text-[#0f172a]"
                  onClick={() => closeFilmRoom()}
                >
                  Back to film library
                </Button>
              </div>
            )}
          </div>
        </FilmRoomModalShell>
      )}
    </>
  )
}

function normalizeClipRow(raw: unknown, film: GameVideoRow): ClipLibraryRow {
  const o = raw as Record<string, unknown>
  const title =
    (typeof o.title === "string" && o.title) || (typeof o.label === "string" && o.label) || null
  let tags: string[] | null = null
  if (Array.isArray(o.tags)) tags = o.tags.map((t) => String(t)).filter(Boolean)
  else if (typeof o.tags === "string") {
    try {
      const p = JSON.parse(o.tags) as unknown
      if (Array.isArray(p)) tags = p.map((t) => String(t))
    } catch {
      tags = o.tags.split(",").map((t) => t.trim()).filter(Boolean)
    }
  }

  return {
    id: String(o.id ?? ""),
    start_ms: Number(o.start_ms ?? o.startMs ?? 0),
    end_ms: Number(o.end_ms ?? o.endMs ?? 0),
    duration_ms: o.duration_ms != null ? Number(o.duration_ms) : null,
    title,
    description: typeof o.description === "string" ? o.description : null,
    tags,
    share_token: typeof o.share_token === "string" ? o.share_token : null,
    metadata: (o.metadata as ClipLibraryRow["metadata"]) ?? null,
    created_at: typeof o.created_at === "string" ? o.created_at : null,
    game_video_id: film.id,
    film_title: film.title ?? null,
    is_private: o.is_private === true,
    attachedPlayerIds: Array.isArray(o.attachedPlayerIds)
      ? (o.attachedPlayerIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
  }
}

function stripToClipRow(c: ClipLibraryRow): ClipRow {
  const { game_video_id: _g, film_title: _f, ...rest } = c
  return rest
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
