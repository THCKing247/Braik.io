"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import {
  PLAYER_FILM_HUB_SECTIONS,
  playerFilmHubRoot,
} from "@/lib/player-portal/player-development-routes"

// ── leaderboard (mock) ────────────────────────────────────────────────────────

const LEADERBOARD = [
  { rank: 1, name: "Jalen R.", detail: "#7 · WR", time: "2h 14m", isMe: false },
  { rank: 2, name: "Brayden A.", detail: "#14 · You", time: "1h 52m", isMe: true },
  { rank: 3, name: "Marcus T.", detail: "#22 · LB", time: "1h 40m", isMe: false },
]

function FilmGrindLeaderboard() {
  return (
    <div className="mb-[16px]">
      <div className="mb-[9px] text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
        Film grind · this week
      </div>
      <div
        className="overflow-hidden rounded-[22px] border border-[rgba(125,155,255,0.14)]"
        style={{ background: "linear-gradient(180deg,#13234E,#0E1B3E)" }}
      >
        {LEADERBOARD.map((row, i) => (
          <div
            key={row.rank}
            className="flex items-center gap-[12px] px-[14px] py-[11px]"
            style={{
              borderTop: i > 0 ? "1px solid rgba(125,155,255,0.14)" : undefined,
              background: row.isMe ? "rgba(255,122,51,0.08)" : undefined,
            }}
          >
            <span
              className="w-[24px] shrink-0 font-black text-[17px] leading-none"
              style={{ transform: "skewX(-6deg)", color: row.isMe ? "#FF7A33" : "#92A5CC" }}
            >
              {row.rank}
            </span>
            <span className="flex-1 text-[13px] font-bold text-[#EEF3FF]">
              {row.name}{" "}
              <span className="text-[10.5px] font-semibold text-[#92A5CC] ml-[6px]">{row.detail}</span>
            </span>
            <span className="text-[12px] font-black text-[#4D9BFF]">{row.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 2×2 tile grid ─────────────────────────────────────────────────────────────

type Tile = {
  key: string
  label: string
  subtitle: string
  badge?: string
  badgeGreen?: boolean
  icon: React.ReactNode
  bg: string
  href: string
}

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="mb-[16px] grid grid-cols-2 gap-[12px]">
      {tiles.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          prefetch={false}
          className="relative flex h-[128px] flex-col justify-between overflow-hidden rounded-[20px] border border-[rgba(125,155,255,0.14)] p-[14px] text-left"
          style={{ background: t.bg }}
        >
          {t.badge ? (
            <span
              className="absolute right-[12px] top-[12px] rounded-[7px] px-[8px] py-[4px] text-[9px] font-black uppercase tracking-[0.06em]"
              style={
                t.badgeGreen
                  ? { background: "#2BD576", color: "#03210F" }
                  : { background: "#FF3D1F", color: "#fff" }
              }
            >
              {t.badge}
            </span>
          ) : null}
          <div className="text-[#EEF3FF]">{t.icon}</div>
          <div>
            <div className="font-black text-[14px] uppercase tracking-[0.03em] text-[#EEF3FF]">
              {t.label}
            </div>
            <div className="text-[10px] font-bold text-[#92A5CC]">{t.subtitle}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ── compact secondary nav for sub-routes ─────────────────────────────────────

function CompactSubNav({ hubBase, pathname }: { hubBase: string; pathname: string }) {
  return (
    <div className="mb-[14px] flex items-center gap-[8px]">
      <Link
        href={hubBase}
        prefetch={false}
        className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] border border-[rgba(125,155,255,0.14)] bg-white/[0.04] text-[#92A5CC] transition hover:text-[#EEF3FF]"
        aria-label="Back to Team Hub"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <nav className="flex gap-[6px] rounded-full border border-[rgba(125,155,255,0.14)] bg-white/[0.04] p-[3px]">
        {PLAYER_FILM_HUB_SECTIONS.map(({ key, label, suffix }) => {
          const href = suffix ? `${hubBase}${suffix}` : hubBase
          const current =
            suffix === ""
              ? pathname === hubBase || pathname === `${hubBase}/`
              : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={key}
              href={href}
              prefetch={false}
              className="rounded-full px-[12px] py-[6px] text-[11px] font-bold uppercase tracking-wide transition"
              style={
                current
                  ? { background: "linear-gradient(90deg,#FF7A33,#FF3D1F)", color: "#160A02" }
                  : { color: "#92A5CC" }
              }
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

// ── shell ─────────────────────────────────────────────────────────────────────

/**
 * Team hub: 2×2 duotone tile grid at hub root; compact secondary nav + content on sub-routes.
 */
export function PlayerPortalPrepShell({ children }: { children: React.ReactNode }) {
  const { accountSegment, teamName } = usePlayerPortal()
  const hubBase = playerFilmHubRoot(accountSegment)
  const pathname = usePathname() ?? ""

  const isHubRoot = pathname === hubBase || pathname === `${hubBase}/`

  // Build tile list using the film hub sections
  const filmTile: Tile = {
    key: "film",
    label: "Game Film",
    subtitle: "Semifinal cut-ups",
    badge: "3 new",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <polygon points="10 9 15 12 10 15" fill="currentColor" stroke="none" />
      </svg>
    ),
    bg: "radial-gradient(200px 140px at 85% -10%,rgba(77,155,255,0.4),transparent 60%),linear-gradient(150deg,#12377A,#0A1638)",
    href: hubBase,
  }
  const playbooksSuffix = PLAYER_FILM_HUB_SECTIONS.find((s) => s.key === "playbooks")?.suffix ?? "/playbooks"
  const studySuffix = PLAYER_FILM_HUB_SECTIONS.find((s) => s.key === "study")?.suffix ?? "/study"

  const tiles: Tile[] = [
    filmTile,
    {
      key: "playbooks",
      label: "Playbooks",
      subtitle: "Red zone install · p.12–14",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
      bg: "radial-gradient(200px 140px at 85% -10%,rgba(255,122,51,0.38),transparent 60%),linear-gradient(150deg,#7A340C,#3D1503)",
      href: `${hubBase}${playbooksSuffix}`,
    },
    {
      key: "study",
      label: "Study",
      subtitle: "🔥 5-day streak",
      badge: "2 due",
      badgeGreen: true,
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      ),
      bg: "radial-gradient(200px 140px at 85% -10%,rgba(43,213,118,0.32),transparent 60%),linear-gradient(150deg,#0F5A35,#062A18)",
      href: `${hubBase}${studySuffix}`,
    },
    {
      key: "roster",
      label: "Roster",
      subtitle: "Depth chart + numbers",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      bg: "radial-gradient(200px 140px at 85% -10%,rgba(122,74,224,0.4),transparent 60%),linear-gradient(150deg,#3A2470,#170D3A)",
      href: hubBase,
    },
  ]

  if (isHubRoot) {
    return (
      <div className="mx-auto w-full max-w-lg pb-4 lg:max-w-2xl">
        {/* header */}
        <div className="mb-[14px] flex items-baseline justify-between">
          <span className="font-black text-[22px] uppercase tracking-[0.02em] text-[#EEF3FF]">Team Hub</span>
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
            {teamName} · 42 players
          </span>
        </div>

        <TileGrid tiles={tiles} />
        <FilmGrindLeaderboard />

        {/* Game Film content (children = PlayerPortalFilmRoom) */}
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC] mb-[9px]">
          Game Film
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg pb-4 lg:max-w-2xl">
      <CompactSubNav hubBase={hubBase} pathname={pathname} />
      {children}
    </div>
  )
}
