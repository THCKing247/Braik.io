"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Clapperboard } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Full-viewport film workspace overlay. Keeps route at /dashboard/game-video while focusing the coach UI.
 * Exit returns to team dashboard home (same teamId).
 */
export function FilmRoomModalShell({ teamId, children }: { teamId: string; children: ReactNode }) {
  const router = useRouter()
  const exit = useCallback(() => {
    router.push(`/dashboard?teamId=${encodeURIComponent(teamId)}`)
  }, [router, teamId])

  const exitRef = useRef(exit)
  exitRef.current = exit

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        exitRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[280] flex flex-col bg-[#070b12] text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="film-room-heading"
      aria-describedby="film-room-subtitle"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#0f172a] px-4 py-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="hidden shrink-0 rounded-xl bg-sky-500/15 p-2.5 text-sky-400 sm:block" aria-hidden>
            <Clapperboard className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 id="film-room-heading" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Film room
            </h1>
            <p id="film-room-subtitle" className="mt-1 text-sm leading-snug text-slate-300 sm:text-[15px]">
              Full-screen workspace — scrub, mark plays, tag teaching moments, build your reel
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="h-12 min-h-[48px] shrink-0 gap-2 border-2 border-white/25 bg-white px-5 text-base font-bold text-[#0f172a] shadow-lg hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
          onClick={exit}
        >
          <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
          Exit film room
        </Button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gradient-to-b from-[#0b1220] to-[#070b12] px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto flex min-h-full max-w-[1920px] flex-col">{children}</div>
      </div>
    </div>
  )
}
