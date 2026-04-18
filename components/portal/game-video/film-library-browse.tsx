"use client"

import { useMemo, useState } from "react"
import { Clapperboard, Film, Loader2, Scissors, Trash2, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { VideoEntitlementSummary } from "@/lib/app/app-bootstrap-types"
import type {
  ClipLibraryRow,
  FilmLibraryFilmStatusFilter,
  FilmLibraryItemType,
  FilmUploadMeta,
  GameVideoRow,
  UploadUiState,
} from "@/components/portal/game-video/game-video-types"
import { formatBytes } from "@/components/portal/game-video/format-bytes"
import { FilmLibraryToolbarFilters } from "@/components/portal/game-video/film-library-toolbar-filters"
import { FilmInfoTip } from "@/components/portal/game-video/film-info-tip"
import { durationMsLabel, formatMsRange } from "@/lib/video/timecode"
import { cn } from "@/lib/utils"
import { VideoUploadZone } from "@/components/portal/game-video/video-upload-zone"
import { TooltipProvider } from "@/components/ui/tooltip"

/** @deprecated Use FilmLibraryItemType from game-video-types */
export type LibraryItemType = FilmLibraryItemType
/** @deprecated Use FilmLibraryFilmStatusFilter from game-video-types */
export type FilmStatusFilter = FilmLibraryFilmStatusFilter

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
  onUploadVideo: (file: File, meta: FilmUploadMeta) => void
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
  const [itemType, setItemType] = useState<FilmLibraryItemType>("all")
  const [filmStatus, setFilmStatus] = useState<FilmLibraryFilmStatusFilter>("all")
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
    <TooltipProvider delayDuration={260}>
      <div className="space-y-3 lg:space-y-4">
        <div className="rounded-lg border border-border/90 bg-card px-3 py-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05] md:px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">Film library</h1>
              {entitlement && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium tabular-nums text-foreground md:text-[11px]">
                    <span className="text-muted-foreground">Storage</span>
                    {formatBytes(entitlement.storageUsedBytes)} / {formatBytes(entitlement.storageCapBytes)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium tabular-nums md:text-[11px]">
                    <span className="text-muted-foreground">Films</span>
                    {entitlement.videoCount}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium tabular-nums md:text-[11px]">
                    <span className="text-muted-foreground">Clips</span>
                    {entitlement.clipCount}
                  </span>
                  {entitlement.sharedStorageScope === "program" && (
                    <span className="text-[10px] font-medium text-muted-foreground md:text-[11px]">Program-shared</span>
                  )}
                </div>
              )}
            </div>
            {canUpload && (
              <div className="min-w-0 w-full lg:max-w-xl lg:flex-1 xl:max-w-2xl">
                <VideoUploadZone
                  variant="library-inline"
                  canUpload={canUpload}
                  taggingEnabled={taggingEnabled}
                  uploadUi={uploadUi}
                  onUpload={(file, meta) => onUploadVideo(file, meta)}
                />
              </div>
            )}
          </div>
        </div>

        <FilmLibraryToolbarFilters
          search={search}
          onSearchChange={setSearch}
          itemType={itemType}
          onItemTypeChange={setItemType}
          filmStatus={filmStatus}
          onFilmStatusChange={setFilmStatus}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          taggingEnabled={taggingEnabled}
          tagOptions={allTags}
          filmStatusDisabled={itemType === "clips"}
          tagFilterDisabled={itemType === "films"}
        />

        {focusFilmId && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs md:text-sm">
            <span className="font-medium text-foreground">Filtering clips to one film</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold"
              onClick={() => setFocusFilmId(null)}
            >
              Clear
            </Button>
          </div>
        )}

        {busy ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading library…
          </div>
        ) : (
          <>
            {showFilms && (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Film className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <h2 className="text-sm font-semibold text-foreground md:text-base">Films</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {filteredVideos.length}
                  </span>
                </div>
                {filteredVideos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground">
                    No films match your filters. Upload video or adjust search.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {filteredVideos.map((v) => (
                      <li
                        key={v.id}
                        className={cn(
                          "rounded-lg border bg-card p-3 shadow-sm transition-colors md:p-3.5",
                          "lg:flex lg:flex-row lg:items-center lg:gap-4 lg:py-2.5 lg:pl-3.5 lg:pr-3",
                          focusFilmId === v.id ? "border-primary ring-1 ring-primary/25" : "border-border hover:border-border/90",
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3 lg:items-center">
                          <div className="hidden shrink-0 rounded-md bg-primary/10 p-2 text-primary lg:flex">
                            <Video className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 font-semibold leading-snug text-foreground">{v.title || "Untitled film"}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 font-semibold",
                                  v.upload_status === "ready"
                                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                                    : "bg-amber-500/15 text-amber-900 dark:text-amber-200",
                                )}
                              >
                                {v.upload_status === "ready" ? "Ready" : v.upload_status || "Processing"}
                              </span>
                              {v.duration_seconds != null && <span className="tabular-nums">{Math.round(v.duration_seconds)}s</span>}
                              {v.file_size_bytes != null && <span>{formatBytes(v.file_size_bytes)}</span>}
                            </div>
                          </div>
                        </div>

                        {canSetRecruitingPrivacy && v.upload_status === "ready" && (
                          <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 lg:mt-0 lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
                            <Checkbox
                              id={`pv-${v.id}`}
                              checked={v.is_private === true}
                              disabled={privacyBusyKey === `v:${v.id}`}
                              onCheckedChange={(checked) => onVideoPrivacyChange?.(v.id, checked === true)}
                              aria-label="Private — hide from recruiters"
                            />
                            <label htmlFor={`pv-${v.id}`} className="cursor-pointer text-xs font-medium leading-none">
                              Private to recruiters
                            </label>
                            <FilmInfoTip label="Recruiter visibility for this film" side="left">
                              <p>When checked, this full game file does not appear on public recruiting profiles.</p>
                            </FilmInfoTip>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 lg:mt-0 lg:min-w-0 lg:flex-1 lg:justify-end lg:border-t-0 lg:pt-0">
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 gap-1.5 bg-[#0F172A] font-semibold text-white hover:bg-[#1E293B] dark:bg-[#1E293B]"
                            onClick={() => onOpenFilmRoom(v.id)}
                            disabled={v.upload_status !== "ready"}
                            title={v.upload_status !== "ready" ? "Wait until this film is ready" : undefined}
                          >
                            <Clapperboard className="h-4 w-4 shrink-0" aria-hidden />
                            Film room
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-9 font-semibold"
                            onClick={() => {
                              setItemType("clips")
                              setFocusFilmId(v.id)
                            }}
                          >
                            Clips
                          </Button>
                          {canDeleteVideo && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 font-semibold text-destructive hover:text-destructive"
                              onClick={() => onDeleteFilm(v)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                              Delete
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
              <section className={cn(showFilms && "mt-6 lg:mt-8")}>
                <div className="mb-2 flex items-center gap-2">
                  <Scissors className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <h2 className="text-sm font-semibold text-foreground md:text-base">Saved clips</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {filteredClips.length}
                  </span>
                </div>
                {filteredClips.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground">
                    No clips yet — open a film and use <strong className="text-foreground">Film room</strong> to mark plays.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {filteredClips.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-lg border border-border bg-card p-3 shadow-sm md:p-3.5 lg:flex lg:flex-row lg:items-center lg:gap-4 lg:py-2.5 lg:pl-3.5 lg:pr-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{c.title || "Untitled clip"}</p>
                          <p className="mt-0.5 text-xs font-medium text-primary">{c.film_title || "Film"}</p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground md:text-xs">
                            {formatMsRange(c.start_ms, c.end_ms)} · {durationMsLabel(c.start_ms, c.end_ms)}
                          </p>
                          {c.description && (
                            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{c.description}</p>
                          )}
                          {taggingEnabled && (c.tags?.length ?? 0) > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {c.tags!.slice(0, 6).map((t) => (
                                <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {canSetRecruitingPrivacy && (
                          <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 lg:mt-0 lg:w-[11rem] lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
                            <Checkbox
                              id={`pc-${c.id}`}
                              checked={c.is_private === true}
                              disabled={privacyBusyKey === `c:${c.id}`}
                              onCheckedChange={(checked) => onClipPrivacyChange?.(c.game_video_id, c.id, checked === true)}
                              aria-label="Private — hide from recruiters"
                            />
                            <label htmlFor={`pc-${c.id}`} className="cursor-pointer text-xs font-medium leading-none">
                              Private to recruiters
                            </label>
                            <FilmInfoTip label="Recruiter visibility for this clip" side="left">
                              <p>When checked, this clip does not appear on public recruiting profiles.</p>
                            </FilmInfoTip>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3 lg:mt-0 lg:justify-end lg:border-t-0 lg:pt-0">
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 flex-1 font-semibold lg:flex-none"
                            onClick={() => onOpenFilmRoom(c.game_video_id, { clipId: c.id })}
                          >
                            Open clip
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 flex-1 font-semibold lg:flex-none"
                            onClick={() => {
                              setFocusFilmId(c.game_video_id)
                              setItemType("all")
                            }}
                          >
                            Source film
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 font-semibold text-destructive hover:text-destructive"
                            onClick={() => onDeleteClip(c)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
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
    </TooltipProvider>
  )
}
