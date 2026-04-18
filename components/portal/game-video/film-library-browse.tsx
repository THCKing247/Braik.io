"use client"

import { useMemo, useState } from "react"
import {
  Clapperboard,
  Film,
  Filter,
  Loader2,
  Scissors,
  Search,
  Trash2,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type { VideoEntitlementSummary } from "@/lib/app/app-bootstrap-types"
import type { ClipLibraryRow, GameVideoRow, UploadUiState } from "@/components/portal/game-video/game-video-types"
import { formatBytes } from "@/components/portal/game-video/format-bytes"
import { durationMsLabel, formatMsRange } from "@/lib/video/timecode"
import { cn } from "@/lib/utils"
import { VideoUploadZone } from "@/components/portal/game-video/video-upload-zone"

export type LibraryItemType = "all" | "films" | "clips"
export type FilmStatusFilter = "all" | "ready" | "processing"

type Props = {
  videos: GameVideoRow[]
  videosLoading: boolean
  clips: ClipLibraryRow[]
  clipsLoading: boolean
  canUpload: boolean
  canDeleteVideo: boolean
  canSetRecruitingPrivacy: boolean
  taggingEnabled: boolean
  entitlement?: VideoEntitlementSummary
  uploadUi: UploadUiState | null
  privacyBusyKey?: string | null
  onVideoPrivacyChange?: (videoId: string, isPrivate: boolean) => void | Promise<void>
  onClipPrivacyChange?: (gameVideoId: string, clipId: string, isPrivate: boolean) => void | Promise<void>
  onUploadVideo: (file: File, coachTitle?: string) => void
  onOpenFilmRoom: (videoId: string, opts?: { clipId?: string }) => void
  onDeleteFilm: (video: GameVideoRow) => void
  onDeleteClip: (clip: ClipLibraryRow) => void
}

function filmDate(v: GameVideoRow): number {
  const t = v.created_at ? Date.parse(v.created_at) : 0
  return Number.isFinite(t) ? t : 0
}

function clipDate(c: ClipLibraryRow): number {
  const t = c.created_at ? Date.parse(c.created_at) : 0
  return Number.isFinite(t) ? t : 0
}

export function FilmLibraryBrowse({
  videos,
  videosLoading,
  clips,
  clipsLoading,
  canUpload,
  canDeleteVideo,
  canSetRecruitingPrivacy,
  taggingEnabled,
  entitlement,
  uploadUi,
  privacyBusyKey,
  onVideoPrivacyChange,
  onClipPrivacyChange,
  onUploadVideo,
  onOpenFilmRoom,
  onDeleteFilm,
  onDeleteClip,
}: Props) {
  const [search, setSearch] = useState("")
  const [itemType, setItemType] = useState<LibraryItemType>("all")
  const [filmStatus, setFilmStatus] = useState<FilmStatusFilter>("all")
  const [tagFilter, setTagFilter] = useState<string>("")
  const [focusFilmId, setFocusFilmId] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const c of clips) {
      for (const t of c.tags ?? []) {
        if (t.trim()) s.add(t.trim())
      }
    }
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [clips])

  const filteredVideos = useMemo(() => {
    let list = [...videos]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((v) => (v.title || "").toLowerCase().includes(q))
    }
    if (filmStatus === "ready") list = list.filter((v) => v.upload_status === "ready")
    if (filmStatus === "processing") list = list.filter((v) => v.upload_status && v.upload_status !== "ready")
    list.sort((a, b) => filmDate(b) - filmDate(a))
    return list
  }, [videos, search, filmStatus])

  const filteredClips = useMemo(() => {
    let list = [...clips]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((c) => {
        const title = (c.title || "").toLowerCase()
        const desc = (c.description || "").toLowerCase()
        const film = (c.film_title || "").toLowerCase()
        const tags = (c.tags ?? []).join(" ").toLowerCase()
        return title.includes(q) || desc.includes(q) || film.includes(q) || tags.includes(q)
      })
    }
    if (tagFilter) {
      list = list.filter((c) => (c.tags ?? []).includes(tagFilter))
    }
    if (focusFilmId) {
      list = list.filter((c) => c.game_video_id === focusFilmId)
    }
    list.sort((a, b) => clipDate(b) - clipDate(a))
    return list
  }, [clips, search, tagFilter, focusFilmId])

  const showFilms = itemType === "all" || itemType === "films"
  const showClips = itemType === "all" || itemType === "clips"

  const busy = videosLoading || clipsLoading

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Film library</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
            Browse game and practice film, find saved clips, then open the film room when you’re ready to mark or edit.
          </p>
        </div>
        {canUpload && (
          <div className="mt-6">
            <VideoUploadZone
              variant="hero"
              canUpload={canUpload}
              uploadUi={uploadUi}
              onUpload={(file, title) => onUploadVideo(file, title)}
            />
          </div>
        )}
      </div>

      {entitlement && (
        <div className="rounded-2xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-foreground shadow-sm">
          <span className="font-semibold">Team video space:</span>{" "}
          <span className="font-mono text-[13px]">
            {formatBytes(entitlement.storageUsedBytes)} / {formatBytes(entitlement.storageCapBytes)}
          </span>
          <span className="text-muted-foreground">
            {" "}
            · {entitlement.videoCount} films · {entitlement.clipCount} clips
            {entitlement.sharedStorageScope === "program" ? " · Program-shared" : ""}
          </span>
        </div>
      )}

      <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
          <Filter className="h-4 w-4 text-primary" aria-hidden />
          Search & filters
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Search
            </label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                className="min-h-[44px] border-2 pl-10 text-base"
                placeholder="Film or clip title, notes, tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Show</label>
            <select
              className="mt-1.5 flex h-11 w-full rounded-xl border-2 border-input bg-background px-3 text-base font-semibold"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as LibraryItemType)}
            >
              <option value="all">Films & clips</option>
              <option value="films">Films only</option>
              <option value="clips">Clips only</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Film status
            </label>
            <select
              className="mt-1.5 flex h-11 w-full rounded-xl border-2 border-input bg-background px-3 text-base font-semibold"
              value={filmStatus}
              onChange={(e) => setFilmStatus(e.target.value as FilmStatusFilter)}
              disabled={itemType === "clips"}
            >
              <option value="all">All</option>
              <option value="ready">Ready to watch</option>
              <option value="processing">Processing</option>
            </select>
          </div>
          {taggingEnabled && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Clip tag
              </label>
              <select
                className="mt-1.5 flex h-11 w-full rounded-xl border-2 border-input bg-background px-3 text-base font-semibold"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                disabled={itemType === "films"}
              >
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {focusFilmId && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
            <span className="font-medium text-foreground">Showing clips from one film.</span>
            <Button type="button" variant="outline" size="sm" className="h-9 font-semibold" onClick={() => setFocusFilmId(null)}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {busy ? (
        <div className="flex items-center justify-center gap-3 py-20 text-base font-medium text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          Loading your library…
        </div>
      ) : (
        <>
          {showFilms && (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="text-lg font-bold text-foreground">Films</h2>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
                  {filteredVideos.length}
                </span>
              </div>
              {filteredVideos.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-base text-muted-foreground">
                  No films match your filters. Upload video or adjust search.
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredVideos.map((v) => (
                    <li
                      key={v.id}
                      className={cn(
                        "flex flex-col rounded-2xl border-2 bg-card p-5 shadow-sm transition-shadow",
                        focusFilmId === v.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:shadow-md",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                          <Video className="h-6 w-6 shrink-0" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-bold leading-snug text-foreground">{v.title || "Untitled film"}</p>
                          <p className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 font-semibold",
                                v.upload_status === "ready"
                                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                                  : "bg-amber-500/15 text-amber-900 dark:text-amber-200",
                              )}
                            >
                              {v.upload_status === "ready" ? "Ready" : v.upload_status || "Processing"}
                            </span>
                            {v.duration_seconds != null && <span>{Math.round(v.duration_seconds)}s</span>}
                            {v.file_size_bytes != null && <span>{formatBytes(v.file_size_bytes)}</span>}
                          </p>
                        </div>
                      </div>
                      {canSetRecruitingPrivacy && v.upload_status === "ready" && (
                        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-left">
                          <Checkbox
                            checked={v.is_private === true}
                            disabled={privacyBusyKey === `v:${v.id}`}
                            onCheckedChange={(checked) => onVideoPrivacyChange?.(v.id, checked === true)}
                            className="mt-1"
                            aria-label="Private video — hide from recruiters"
                          />
                          <span className="text-sm leading-snug text-foreground">
                            <span className="font-bold">Private (hide from recruiters)</span>
                            <span className="mt-0.5 block text-muted-foreground">
                              When checked, this film will not appear on public recruiting profiles.
                            </span>
                          </span>
                        </label>
                      )}
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                        <Button
                          type="button"
                          size="lg"
                          className="min-h-[48px] w-full gap-2 bg-[#0F172A] font-bold text-white hover:bg-[#1E293B] sm:flex-1 dark:bg-[#1E293B]"
                          onClick={() => onOpenFilmRoom(v.id)}
                          disabled={v.upload_status !== "ready"}
                          title={v.upload_status !== "ready" ? "Wait until this film is ready" : undefined}
                        >
                          <Clapperboard className="h-5 w-5 shrink-0" aria-hidden />
                          Film room — add / edit clips
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="font-semibold"
                          onClick={() => {
                            setItemType("clips")
                            setFocusFilmId(v.id)
                          }}
                        >
                          View clips
                        </Button>
                        {canDeleteVideo && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="font-semibold text-destructive hover:text-destructive"
                            onClick={() => onDeleteFilm(v)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                            Delete film
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {showClips && (
            <section className={cn(showFilms && "pt-4")}>
              <div className="mb-4 flex items-center gap-2">
                <Scissors className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="text-lg font-bold text-foreground">Saved clips</h2>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
                  {filteredClips.length}
                </span>
              </div>
              {filteredClips.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-base text-muted-foreground">
                  No clips yet — open a film and use <strong className="text-foreground">Add / edit clips</strong> to mark plays.
                </p>
              ) : (
                <ul className="grid gap-4 lg:grid-cols-2">
                  {filteredClips.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm"
                    >
                      <p className="font-bold text-foreground">{c.title || "Untitled clip"}</p>
                      <p className="mt-1 text-sm font-medium text-primary">{c.film_title || "Film"}</p>
                      <p className="mt-2 font-mono text-sm text-muted-foreground">
                        {formatMsRange(c.start_ms, c.end_ms)} · {durationMsLabel(c.start_ms, c.end_ms)}
                      </p>
                      {c.description && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                          {c.description}
                        </p>
                      )}
                      {taggingEnabled && (c.tags?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.tags!.slice(0, 8).map((t) => (
                            <span
                              key={t}
                              className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {canSetRecruitingPrivacy && (
                        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-left">
                          <Checkbox
                            checked={c.is_private === true}
                            disabled={privacyBusyKey === `c:${c.id}`}
                            onCheckedChange={(checked) =>
                              onClipPrivacyChange?.(c.game_video_id, c.id, checked === true)
                            }
                            className="mt-1"
                            aria-label="Private clip — hide from recruiters"
                          />
                          <span className="text-sm leading-snug text-foreground">
                            <span className="font-bold">Private (hide from recruiters)</span>
                            <span className="mt-0.5 block text-muted-foreground">
                              When checked, this clip will not appear on public recruiting profiles.
                            </span>
                          </span>
                        </label>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                        <Button
                          type="button"
                          size="lg"
                          className="min-h-[44px] flex-1 font-bold"
                          onClick={() => onOpenFilmRoom(c.game_video_id, { clipId: c.id })}
                        >
                          Open clip
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[44px] flex-1 border-2 font-semibold"
                          onClick={() => {
                            setFocusFilmId(c.game_video_id)
                            setItemType("all")
                          }}
                        >
                          View source film
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="font-semibold text-destructive hover:text-destructive"
                          onClick={() => onDeleteClip(c)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
