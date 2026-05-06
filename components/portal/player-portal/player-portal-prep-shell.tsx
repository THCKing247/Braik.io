"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { cn } from "@/lib/utils"
import {
  PLAYER_FILM_HUB_SECTIONS,
  playerFilmHubRoot,
} from "@/lib/player-portal/player-development-routes"
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"

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
        className={cn(
          "mb-4 rounded-2xl border p-1 shadow-inner shadow-black/30 backdrop-blur-sm",
          braikPlayerTheme.surface
        )}
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
                      ? braikPlayerTheme.activeTab
                      : `${braikPlayerTheme.inactiveTab} active:bg-[#10265f]`
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
