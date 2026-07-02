"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Bell, Settings, FileText, Folder, LogOut } from "lucide-react"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { PlayerPortalDocuments } from "@/components/portal/player-portal/player-portal-documents"
import { signOut } from "@/lib/auth/client-auth"

type ProfilePayload = {
  profile?: {
    firstName?: string | null
    lastName?: string | null
    preferredName?: string | null
    jerseyNumber?: number | null
    positionGroup?: string | null
    grade?: string | null
    eligibilityStatus?: string | null
  }
}

// ── player card ───────────────────────────────────────────────────────────────

function PlayerCard({
  displayName,
  jerseyNumber,
  positionGroup,
  eligibilityStatus,
  teamName,
}: {
  displayName: string
  jerseyNumber?: number | null
  positionGroup?: string | null
  eligibilityStatus?: string | null
  teamName: string
}) {
  const [first = "", last = ""] = displayName.split(/\s+/)

  return (
    <div
      className="relative mb-[14px] overflow-hidden rounded-[22px] border border-[rgba(255,140,70,0.28)] p-[20px_18px_16px]"
      style={{
        background:
          "radial-gradient(360px 220px at 100% 0%,rgba(255,122,51,0.22),transparent 60%),linear-gradient(160deg,#14275C,#0A1638)",
      }}
    >
      {/* giant jersey number watermark */}
      <span
        className="pointer-events-none absolute right-[2px] top-[-28px] select-none font-black text-[150px] leading-none text-[rgba(255,122,51,0.13)]"
        style={{ transform: "skewX(-8deg)" }}
        aria-hidden
      >
        {jerseyNumber ?? "14"}
      </span>

      <div className="mb-[8px] text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
        {teamName} · 2026
      </div>
      <div
        className="mb-[11px] font-black text-[26px] uppercase leading-[1.05] tracking-[0.02em] text-[#EEF3FF]"
      >
        {first}
        <br />
        {last}
      </div>
      <div className="flex flex-wrap gap-[7px]">
        {jerseyNumber != null ? (
          <span className="rounded-[8px] border border-[rgba(255,122,51,0.4)] bg-[rgba(255,122,51,0.1)] px-[11px] py-[5px] text-[10.5px] font-black tracking-[0.05em] text-[#FF7A33]">
            #{jerseyNumber}
          </span>
        ) : null}
        {positionGroup ? (
          <span className="rounded-[8px] border border-[rgba(125,155,255,0.14)] bg-white/[0.05] px-[11px] py-[5px] text-[10.5px] font-black tracking-[0.05em] text-[#EEF3FF]">
            {positionGroup}
          </span>
        ) : null}
        {eligibilityStatus ? (
          <span className="rounded-[8px] border border-[rgba(43,213,118,0.4)] bg-[rgba(43,213,118,0.1)] px-[11px] py-[5px] text-[10.5px] font-black tracking-[0.05em] text-[#2BD576]">
            ✓ Eligible
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ── season stats ──────────────────────────────────────────────────────────────

const STATS = [
  { value: "6", label: "Games" },
  { value: "412", label: "Rec yds" },
  { value: "5", label: "TDs" },
]

function StatsStrip() {
  return (
    <div className="mb-[14px] grid grid-cols-3 gap-[10px]">
      {STATS.map((s) => (
        <div
          key={s.label}
          className="rounded-[22px] border border-[rgba(125,155,255,0.14)] bg-gradient-to-b from-[#13234E] to-[#0E1B3E] px-[8px] py-[13px] text-center"
        >
          <span
            className="block font-black text-[23px] leading-none text-[#EEF3FF]"
            style={{ transform: "skewX(-6deg)" }}
          >
            {s.value}
          </span>
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#92A5CC]">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── highlights grid ───────────────────────────────────────────────────────────

const HL_CLIPS = [
  { id: "1", bg: "radial-gradient(120px 80px at 30% 10%,rgba(255,122,51,0.4),transparent),linear-gradient(140deg,#7A340C,#3D1503)", dur: "0:24" },
  { id: "2", bg: "radial-gradient(120px 80px at 70% 10%,rgba(77,155,255,0.4),transparent),linear-gradient(140deg,#12377A,#0A1638)", dur: "0:31" },
]

function HighlightsGrid() {
  return (
    <div className="mb-[16px]">
      <div className="mb-[9px] text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
        Highlights
      </div>
      <div className="grid grid-cols-3 gap-[9px]">
        {HL_CLIPS.map((c) => (
          <div
            key={c.id}
            className="relative flex h-[92px] cursor-pointer items-center justify-center overflow-hidden rounded-[14px] border border-white/[0.07]"
            style={{ background: c.bg }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="text-white/80">
              <polygon points="6 3 21 12 6 21" />
            </svg>
            <span className="absolute bottom-[6px] right-[6px] rounded-[6px] bg-[rgba(3,8,26,0.7)] px-[6px] py-[3px] text-[9px] font-black text-white">
              {c.dur}
            </span>
          </div>
        ))}
        <button
          type="button"
          className="flex h-[92px] flex-col items-center justify-center gap-[5px] rounded-[14px] border border-dashed border-[rgba(146,165,204,0.4)] bg-white/[0.02] text-[11px] font-bold text-[#92A5CC]"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add clip
        </button>
      </div>
    </div>
  )
}

// ── my stuff rows ─────────────────────────────────────────────────────────────

type StuffRow = {
  icon: React.ReactNode
  label: string
  count?: string
  danger?: boolean
  onClick?: () => void
}

function MyStuffList({ rows }: { rows: StuffRow[] }) {
  return (
    <div className="mb-[14px] overflow-hidden rounded-[22px] border border-[rgba(125,155,255,0.14)] bg-gradient-to-b from-[#13234E] to-[#0E1B3E]">
      {rows.map((row, i) => (
        <button
          key={row.label}
          type="button"
          onClick={row.onClick}
          className="flex w-full items-center gap-[12px] px-[15px] py-[14px] text-left transition hover:bg-white/[0.03]"
          style={{ borderTop: i > 0 ? "1px solid rgba(125,155,255,0.14)" : undefined }}
        >
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[rgba(125,155,255,0.14)] bg-white/[0.05]"
            style={{ color: row.danger ? "#FF6B5A" : "#92A5CC" }}
          >
            {row.icon}
          </span>
          <span
            className="flex-1 text-[13.5px] font-semibold"
            style={{ color: row.danger ? "#FF6B5A" : "#EEF3FF" }}
          >
            {row.label}
          </span>
          {row.count ? (
            <span className="text-[11px] font-semibold text-[#92A5CC]">{row.count}</span>
          ) : null}
          {!row.danger ? (
            <ChevronRight className="h-[15px] w-[15px] shrink-0 text-[#92A5CC]" />
          ) : null}
        </button>
      ))}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function PlayerPortalProfilePage() {
  const { accountSegment, teamId, teamName } = usePlayerPortal()
  const [data, setData] = useState<ProfilePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDocs, setShowDocs] = useState(false)

  useEffect(() => {
    let cancelled = false
    const url = `/api/roster/${encodeURIComponent(accountSegment)}/profile?teamId=${encodeURIComponent(teamId)}`
    setLoading(true)
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ProfilePayload | null) => {
        if (!cancelled) setData(j)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [accountSegment, teamId])

  const p = data?.profile
  const displayName =
    [p?.preferredName?.trim(), p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() ||
    [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() ||
    "Brayden Adams"

  const stuffRows: StuffRow[] = [
    {
      icon: <FileText className="h-4 w-4" />,
      label: "My documents",
      count: "0 uploaded",
      onClick: () => setShowDocs((v) => !v),
    },
    {
      icon: <Folder className="h-4 w-4" />,
      label: "Team library",
      count: "5 files",
    },
    {
      icon: <Bell className="h-4 w-4" />,
      label: "Notifications",
    },
    {
      icon: <Settings className="h-4 w-4" />,
      label: "Settings",
    },
    {
      icon: <LogOut className="h-4 w-4" />,
      label: "Sign out",
      danger: true,
      onClick: () => void signOut({ callbackUrl: "/login" }),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-lg pb-4 lg:max-w-2xl">
      {loading ? (
        <div className="mb-[14px] h-[160px] animate-pulse rounded-[22px] border border-[rgba(125,155,255,0.14)] bg-gradient-to-b from-[#13234E] to-[#0E1B3E]" />
      ) : (
        <PlayerCard
          displayName={displayName}
          jerseyNumber={p?.jerseyNumber}
          positionGroup={p?.positionGroup}
          eligibilityStatus={p?.eligibilityStatus}
          teamName={teamName}
        />
      )}

      <StatsStrip />
      <HighlightsGrid />

      <div className="mb-[9px] text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
        My stuff
      </div>
      <MyStuffList rows={stuffRows} />

      {showDocs ? (
        <div className="mt-[8px]">
          <PlayerPortalDocuments />
        </div>
      ) : null}
    </div>
  )
}
