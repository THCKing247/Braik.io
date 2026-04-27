"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { cn } from "@/lib/utils"
import {
  PLAYER_FILM_HUB_SECTIONS,
  playerFilmHubRoot,
} from "@/lib/player-portal/player-development-routes"

/**
 * Team hub: one app-style segmented control (mobile-first, large tap targets).
 * Study → Film → Playbooks supports learn / quiz → film → installs; coach feedback stays in Messages + Home.
 */
export function PlayerPortalPrepShell({ children }: { children: React.ReactNode }) {
  const { accountSegment } = usePlayerPortal()
  const hubBase = playerFilmHubRoot(accountSegment)
  const pathname = usePathname() ?? ""

  return (
    <div className="mx-auto w-full max-w-lg lg:max-w-2xl">
      <nav
        aria-label="Study, game film, and playbooks"
        aria-description="Study includes quizzes. Use Messages from the bottom bar to reach coaches."
        className="mb-4 rounded-2xl border border-white/15 bg-black/25 p-1 shadow-inner shadow-black/20 backdrop-blur-sm"
      >
        <ul className="grid grid-cols-3 gap-1">
          {PLAYER_FILM_HUB_SECTIONS.map(({ key, label, suffix }) => {
            const href = suffix ? `${hubBase}${suffix}` : hubBase
            const current =
              suffix === ""
                ? pathname === hubBase || pathname === `${hubBase}/`
                : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={key} className="min-w-0">
                <Link
                  href={href}
                  prefetch={false}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex min-h-[2.75rem] w-full select-none items-center justify-center rounded-xl px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide transition active:scale-[0.98] sm:text-xs sm:tracking-normal",
                    current
                      ? "bg-white text-slate-900 shadow-md"
                      : "text-white/85 hover:bg-white/10 active:bg-white/15"
                  )}
                >
                  <span className="line-clamp-2 leading-snug">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      {children}
    </div>
  )
}
