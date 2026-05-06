"use client"

import Link from "next/link"
import { ChevronRight, Clock3 } from "lucide-react"
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"

type PlayerTeamHeroProps = {
  firstName: string
  teamName: string
  sport?: string | null
  basePath: string
}

/** Top-of-feed identity + quick “next up” strip (mock schedule until API wiring). */
export function PlayerTeamHero({ firstName, teamName, sport, basePath }: PlayerTeamHeroProps) {
  return (
    <section className="space-y-2.5">
      <div className={`rounded-2xl border px-3 py-2.5 backdrop-blur-md ${braikPlayerTheme.surface}`}>
        <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${braikPlayerTheme.textSecondary}`}>Feed</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={`truncate text-[15px] font-black ${braikPlayerTheme.textWarm}`}>Hey {firstName}</p>
            <p className={`truncate text-[11px] font-medium ${braikPlayerTheme.textMuted}`}>
              {teamName}
              {sport?.trim() ? ` · ${sport}` : ""}
            </p>
          </div>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${braikPlayerTheme.heroBadge}`}>
            B
          </div>
        </div>
      </div>

      <Link
        href={`${basePath}/calendar`}
        prefetch={false}
        className={`group flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 shadow-inner backdrop-blur-md transition active:scale-[0.99] ${braikPlayerTheme.surfaceSoft}`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F85808]/20">
          <Clock3 className="h-4 w-4 text-[#F85808]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${braikPlayerTheme.textSecondary}`}>Next game</p>
          <p className={`truncate text-sm font-bold ${braikPlayerTheme.textWarm}`}>Friday · 7:00 PM · vs Central Eagles</p>
          <p className={`text-[11px] font-medium ${braikPlayerTheme.textMuted}`}>Home · Gates open 5:30 · mock schedule</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#9aa8c7] transition group-hover:text-[#F8F8F8]" aria-hidden />
      </Link>
    </section>
  )
}
