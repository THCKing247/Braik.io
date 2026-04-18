"use client"

import { useEffect, useState } from "react"
import { Loader2, Video } from "lucide-react"
import { ClipSegmentVideo } from "@/components/recruiting/recruiting-film-section"
import type { RecruitingFilmPayload } from "@/lib/recruiting/recruiting-media"

export function PlayerAttachedFilmPanel({ playerId, teamId }: { playerId: string; teamId: string }) {
  const [film, setFilm] = useState<RecruitingFilmPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    fetch(`/api/roster/${playerId}/attached-film?teamId=${encodeURIComponent(teamId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to load film")
        return data as { film: RecruitingFilmPayload }
      })
      .then((data) => {
        if (!cancelled) setFilm(data.film)
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load film")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [playerId, teamId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading film…
      </div>
    )
  }
  if (err) {
    return <p className="text-sm text-red-600">{err}</p>
  }
  if (!film) return null

  const hasBraik =
    film.braikVideos.some((v) => v.playbackUrl) || film.braikClips.some((c) => c.playbackUrl)
  const hasExternal = film.externalLinks.length > 0
  if (!hasBraik && !hasExternal) return null

  return (
    <div className="space-y-5 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        <Video className="h-4 w-4" aria-hidden />
        Film &amp; video
      </h3>

      {hasExternal && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase text-[#64748B]">External links</p>
          <ul className="space-y-2">
            {film.externalLinks.map((link, i) => (
              <li key={`${link.url}-${i}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#2563EB] hover:underline"
                >
                  {link.videoType.replace(/_/g, " ")} →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {film.braikVideos.some((v) => v.playbackUrl) && (
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase text-[#64748B]">Team film (Braik)</p>
          {film.braikVideos.map(
            (v) =>
              v.playbackUrl && (
                <div key={v.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <p className="font-medium text-[#0F172A]">{v.title || "Untitled film"}</p>
                  <p className="text-xs text-[#64748B]">Full game / practice</p>
                  <video
                    className="mt-2 aspect-video w-full rounded-md bg-black"
                    controls
                    playsInline
                    preload="metadata"
                    src={v.playbackUrl}
                    title={v.title || "Film"}
                  />
                </div>
              ),
          )}
        </div>
      )}

      {film.braikClips.some((c) => c.playbackUrl) && (
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase text-[#64748B]">Clips (Braik)</p>
          {film.braikClips.map(
            (c) =>
              c.playbackUrl && (
                <div key={c.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <p className="font-medium text-[#0F172A]">{c.title || "Clip"}</p>
                  <p className="text-xs text-[#64748B]">From {c.parentVideoTitle || "film"}</p>
                  <ClipSegmentVideo
                    src={c.playbackUrl}
                    startMs={c.startMs}
                    endMs={c.endMs}
                    title={c.title || "Clip"}
                  />
                </div>
              ),
          )}
        </div>
      )}
    </div>
  )
}
