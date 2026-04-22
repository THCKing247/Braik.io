"use client"

import Link from "next/link"
import { ChevronRight, Clock3, Sparkles } from "lucide-react"

type PlayerTeamHeroProps = {
  firstName: string
  teamName: string
  sport?: string | null
  basePath: string
}

/** Top-of-feed identity + quick “next up” strip (mock schedule until API wiring). */
export function PlayerTeamHero({ firstName, teamName, sport, basePath }: PlayerTeamHeroProps) {
  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/15 bg-gradient-to-br from-white/[0.14] to-white/[0.06] p-5 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-sky-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-amber-400 to-orange-600 text-lg font-black text-white shadow-lg ring-2 ring-white/40">
            B
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-300/95">Team stream</p>
            <h2 className="mt-1 font-black leading-tight">
              <span className="bg-gradient-to-r from-white via-amber-100 to-orange-100 bg-clip-text text-2xl text-transparent">
                Hey {firstName}
              </span>
            </h2>
            <p className="mt-1 truncate text-[15px] font-semibold text-white/85">{teamName}</p>
            {sport?.trim() ? <p className="text-sm font-medium text-white/60">{sport}</p> : null}
          </div>
        </div>
      </div>

      <Link
        href={`${basePath}/calendar`}
        prefetch={false}
        className="group flex items-center gap-3 rounded-2xl border border-sky-400/25 bg-black/30 px-4 py-3.5 shadow-inner backdrop-blur-md transition active:scale-[0.99]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600/40 to-orange-600/30">
          <Clock3 className="h-5 w-5 text-amber-200" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-sky-300/90">Next up</p>
          <p className="truncate font-bold text-white">Friday · 7:00 PM · vs Central Eagles</p>
          <p className="text-xs font-medium text-white/55">Home · Gates open 5:30 · mock schedule</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/40 transition group-hover:text-white/70" aria-hidden />
      </Link>

      <div className="flex items-center gap-2 rounded-2xl border border-orange-400/15 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white/80 backdrop-blur-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <span>
          Your feed shows coach posts, highlights, and team moments — pull down to refresh once live data ships.
        </span>
      </div>
    </section>
  )
}
