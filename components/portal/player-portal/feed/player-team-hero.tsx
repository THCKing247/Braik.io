"use client"

import Link from "next/link"
import { ChevronRight, Clock3 } from "lucide-react"

type PlayerTeamHeroProps = {
  firstName: string
  teamName: string
  sport?: string | null
  basePath: string
}

/** Top-of-feed identity + quick “next up” strip (mock schedule until API wiring). */
export function PlayerTeamHero({ firstName, teamName, sport, basePath }: PlayerTeamHeroProps) {
  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur-md">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300/85">Feed</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-white">Hey {firstName}</p>
            <p className="truncate text-xs font-medium text-white/70">
              {teamName}
              {sport?.trim() ? ` · ${sport}` : ""}
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-amber-400 to-orange-600 text-xs font-black text-white">
            B
          </div>
        </div>
      </div>

      <Link
        href={`${basePath}/calendar`}
        prefetch={false}
        className="group flex items-center gap-3 rounded-2xl border border-sky-400/25 bg-black/30 px-3.5 py-3 shadow-inner backdrop-blur-md transition active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600/40 to-orange-600/30">
          <Clock3 className="h-5 w-5 text-amber-200" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">Next game</p>
          <p className="truncate font-bold text-white">Friday · 7:00 PM · vs Central Eagles</p>
          <p className="text-xs font-medium text-white/55">Home · Gates open 5:30 · mock schedule</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/40 transition group-hover:text-white/70" aria-hidden />
      </Link>
    </section>
  )
}
