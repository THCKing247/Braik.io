"use client"

import type { ReactNode } from "react"
import { useEffect, useRef } from "react"
import { ArrowLeft, Clapperboard } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Full-viewport film workspace overlay. Parent supplies onExit (e.g. back to in-route film library).
 */
export function FilmRoomModalShell({
  onExit,
  exitLabel = "Back to film library",
  children,
}: {
  onExit: () => void
  exitLabel?: string
  children: ReactNode
}) {
  const exitRef = useRef(onExit)
  exitRef.current = onExit

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
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0f172a] px-3 py-2 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="hidden shrink-0 rounded-lg bg-sky-500/15 p-2 text-sky-400 sm:flex" aria-hidden>
            <Clapperboard className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 id="film-room-heading" className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Film room
            </h1>
            <p id="film-room-subtitle" className="sr-only">
              Workspace to scrub film, mark plays, and save clips.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-9 shrink-0 gap-2 border border-white/25 bg-white px-4 text-sm font-semibold text-[#0f172a] shadow-sm hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
          onClick={() => exitRef.current()}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {exitLabel}
        </Button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gradient-to-b from-[#0b1220] to-[#070b12] px-2 py-3 sm:px-3 sm:py-3">
        <div className="mx-auto flex min-h-full max-w-[1920px] flex-col">{children}</div>
      </div>
    </div>
  )
}
