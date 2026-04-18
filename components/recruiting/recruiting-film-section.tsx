"use client"

import { useEffect, useRef } from "react"

export type ExternalFilmLink = { videoType: string; url: string; sortOrder: number }
export type BraikFilmVideo = {
  id: string
  title: string | null
  playbackUrl: string | null
  durationSeconds: number | null
}
export type BraikFilmClip = {
  id: string
  title: string | null
  playbackUrl: string | null
  startMs: number
  endMs: number
  parentVideoTitle: string | null
}

export function ClipSegmentVideo({
  src,
  startMs,
  endMs,
  title,
}: {
  src: string
  startMs: number
  endMs: number
  title: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const startSec = startMs / 1000
    const endSec = endMs / 1000

    const onLoaded = () => {
      try {
        el.currentTime = startSec
      } catch {
        /* noop */
      }
    }
    const onTimeUpdate = () => {
      if (el.currentTime >= endSec - 0.05) {
        el.pause()
      }
    }

    el.addEventListener("loadedmetadata", onLoaded)
    el.addEventListener("timeupdate", onTimeUpdate)
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded)
      el.removeEventListener("timeupdate", onTimeUpdate)
    }
  }, [src, startMs, endMs])

  return (
    <video
      ref={ref}
      className="mt-3 aspect-video w-full rounded-lg bg-black"
      controls
      playsInline
      preload="metadata"
      title={title}
      src={src}
    />
  )
}

export function RecruitingFilmSection({
  externalLinks,
  braikVideos,
  braikClips,
  hudlUrl,
  youtubeUrl,
}: {
  externalLinks: ExternalFilmLink[]
  braikVideos: BraikFilmVideo[]
  braikClips: BraikFilmClip[]
  hudlUrl: string | null
  youtubeUrl: string | null
}) {
  const hasAnything =
    externalLinks.length > 0 ||
    braikVideos.some((v) => v.playbackUrl) ||
    braikClips.some((c) => c.playbackUrl) ||
    hudlUrl ||
    youtubeUrl

  if (!hasAnything) return null

  return (
    <section className="border-b border-gray-800 p-6 md:p-8">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Film &amp; video</h2>

      {externalLinks.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">External links</h3>
          <ul className="space-y-2">
            {externalLinks.map((link, i) => (
              <li key={`${link.url}-${i}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="capitalize text-blue-400 hover:text-blue-300 hover:underline"
                >
                  {link.videoType.replace(/_/g, " ")} →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {braikVideos.some((v) => v.playbackUrl) && (
        <div className="mb-6 space-y-6">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Attached team film (Braik)</h3>
          {braikVideos.map((v) =>
            v.playbackUrl ? (
              <div key={v.id} className="rounded-lg border border-gray-700/80 bg-black/20 p-4">
                <p className="font-medium text-white">{v.title || "Untitled film"}</p>
                <p className="text-xs text-gray-500">Full game / practice video</p>
                {v.durationSeconds != null && (
                  <p className="mt-1 text-xs text-gray-500">{Math.round(v.durationSeconds)}s</p>
                )}
                <video
                  className="mt-3 aspect-video w-full rounded-lg bg-black"
                  controls
                  playsInline
                  preload="metadata"
                  src={v.playbackUrl}
                  title={v.title || "Film"}
                />
              </div>
            ) : null,
          )}
        </div>
      )}

      {braikClips.some((c) => c.playbackUrl) && (
        <div className="mb-6 space-y-6">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Attached clips (Braik)</h3>
          {braikClips.map((c) =>
            c.playbackUrl ? (
              <div key={c.id} className="rounded-lg border border-gray-700/80 bg-black/20 p-4">
                <p className="font-medium text-white">{c.title || "Clip"}</p>
                <p className="text-xs text-gray-500">
                  From {c.parentVideoTitle || "team film"} · segment playback
                </p>
                <ClipSegmentVideo
                  src={c.playbackUrl}
                  startMs={c.startMs}
                  endMs={c.endMs}
                  title={c.title || "Clip"}
                />
              </div>
            ) : null,
          )}
        </div>
      )}

      {(hudlUrl || youtubeUrl) && (
        <div className="flex flex-wrap gap-4">
          {hudlUrl && (
            <a href={hudlUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline">
              Hudl profile →
            </a>
          )}
          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              YouTube →
            </a>
          )}
        </div>
      )}
    </section>
  )
}
