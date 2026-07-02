"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PlayerFeedPost, PlayerFeedReaction } from "@/components/portal/player-portal/feed/player-feed-types"
import { FeedKindBadge } from "@/components/portal/player-portal/feed/feed-kind-badge"
import { FeedMediaPlaceholder } from "@/components/portal/player-portal/feed/feed-media-placeholder"
import {
  AnnouncementDetailSheet,
  type ReactionCount,
} from "@/components/portal/player-portal/feed/announcement-detail-sheet"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { cn } from "@/lib/utils"

// ── avatar ────────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  "linear-gradient(140deg,#2C4E9E,#152B63)",
  "linear-gradient(140deg,#B24A17,#6E2508)",
  "linear-gradient(140deg,#1E6FD9,#0E3E8C)",
  "linear-gradient(140deg,#178C56,#0B4A2C)",
  "linear-gradient(140deg,#7A4AE0,#3A1E86)",
]
function avatarGradient(label: string) {
  const idx = Math.abs(label.charCodeAt(0)) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[idx] ?? AVATAR_GRADIENTS[0]
}

function Avatar({
  label,
  role,
}: {
  label: string
  role?: "coach" | "team" | "player"
}) {
  const initial = label.trim().charAt(0).toUpperCase() || "?"
  const ringStyle =
    role === "coach"
      ? { boxShadow: "0 0 0 2px #060D22, 0 0 0 4px #FF7A33" }
      : role === "team"
        ? { boxShadow: "0 0 0 2px #060D22, 0 0 0 4px #4D9BFF" }
        : {}

  return (
    <div
      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[13px] font-black text-white"
      style={{ background: avatarGradient(label), ...ringStyle }}
    >
      {initial}
    </div>
  )
}

// ── score block ───────────────────────────────────────────────────────────────

function ScoreBlock() {
  return (
    <div
      className="relative flex h-[190px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[16px] border border-white/[0.07]"
      style={{
        background:
          "radial-gradient(circle 3px at 12% 26%,rgba(255,198,61,.9) 40%,transparent 45%)," +
          "radial-gradient(circle 2.5px at 84% 18%,rgba(255,122,51,.9) 40%,transparent 45%)," +
          "radial-gradient(circle 2px at 68% 74%,rgba(77,155,255,.9) 40%,transparent 45%)," +
          "radial-gradient(circle 3px at 30% 82%,rgba(43,213,118,.85) 40%,transparent 45%)," +
          "radial-gradient(circle 2px at 50% 12%,rgba(255,255,255,.8) 40%,transparent 45%)," +
          "radial-gradient(420px 220px at 50% 120%,rgba(43,213,118,.22),transparent 65%)," +
          "linear-gradient(135deg,#0F2B66,#081231)",
      }}
    >
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#92A5CC]">
        FINAL · SEMIFINAL · HOME
      </span>
      <div className="flex items-center gap-4">
        <span className="font-black text-[15px] uppercase tracking-[0.03em] text-[#EEF3FF]">TST</span>
        <span className="font-black text-[46px] leading-none text-[#EEF3FF]" style={{ transform: "skewX(-7deg)", textShadow: "0 0 26px rgba(43,213,118,0.55)" }}>28</span>
        <span className="font-black text-[46px] leading-none text-[rgba(146,165,204,0.55)]" style={{ transform: "skewX(-7deg)" }}>17</span>
        <span className="font-black text-[15px] uppercase tracking-[0.03em] text-[#92A5CC]">CE</span>
      </div>
      <span className="rounded-[9px] px-[14px] py-[5px] font-black text-[12px] uppercase tracking-[0.1em] text-[#03210F]" style={{ background: "#2BD576", boxShadow: "0 8px 22px -6px rgba(43,213,118,0.6)" }}>
        W · ON TO THE FINAL
      </span>
    </div>
  )
}

// ── reaction pill ─────────────────────────────────────────────────────────────

function ReactionPill({
  emoji,
  count,
  active,
  onToggle,
}: {
  emoji: string
  count: number
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={cn(
        "inline-flex items-center gap-[6px] rounded-full border px-[12px] py-[7px] text-[12px] font-bold text-[#EEF3FF] transition-transform active:scale-[0.92]",
        active
          ? "border-[rgba(255,122,51,0.5)] bg-[rgba(255,122,51,0.16)]"
          : "border-[rgba(125,155,255,0.14)] bg-white/[0.035]"
      )}
    >
      {emoji} <span>{count}</span>
    </button>
  )
}

// ── main card ─────────────────────────────────────────────────────────────────

export function FeedPostCard({
  post,
  accountBasePath: _accountBasePath,
}: {
  post: PlayerFeedPost
  accountBasePath: string
}) {
  const { teamId } = usePlayerPortal()
  const isAnnouncement = post.kind === "coach_announcement" && Boolean(post.announcementId)
  const apiBase = isAnnouncement
    ? `/api/teams/${encodeURIComponent(teamId)}/team-announcements/${encodeURIComponent(post.announcementId!)}`
    : null

  // Reaction state — initialized from prop, then overridden by API
  const [reactions, setReactions] = useState<PlayerFeedReaction[]>(
    (post.reactions ?? []).map((r) => ({ ...r }))
  )
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0)
  const [viewCount, setViewCount] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [scrollToComments, setScrollToComments] = useState(false)
  const viewTracked = useRef(false)

  // Fetch live reaction counts on mount
  useEffect(() => {
    if (!apiBase) return
    fetch(`${apiBase}/reactions`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { counts?: ReactionCount[]; mine?: string[] } | null) => {
        if (!data?.counts) return
        setReactions((prev) => {
          const allEmojis = new Set([...prev.map((r) => r.emoji), ...data.counts!.map((c) => c.emoji)])
          return [...allEmojis].map((emoji) => {
            const apiCount = data.counts!.find((c) => c.emoji === emoji)
            const prevReaction = prev.find((r) => r.emoji === emoji)
            return {
              emoji,
              count: apiCount?.total_count ?? prevReaction?.count ?? 0,
              reactedByMe: data.mine?.includes(emoji) ?? prevReaction?.reactedByMe ?? false,
            }
          }).filter((r) => r.count > 0 || post.reactions?.find((p) => p.emoji === r.emoji))
        })
      })
      .catch(() => null)
  }, [apiBase])

  // Fetch comment count
  useEffect(() => {
    if (!apiBase) return
    fetch(`${apiBase}/comments`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { total?: number } | null) => {
        if (data?.total != null) setCommentCount(data.total)
      })
      .catch(() => null)
  }, [apiBase])

  // Fetch view count
  useEffect(() => {
    if (!apiBase) return
    fetch(`${apiBase}/views`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { count?: number } | null) => {
        if (data?.count != null) setViewCount(data.count)
      })
      .catch(() => null)
  }, [apiBase])

  // Mark as viewed once (fire-and-forget)
  useEffect(() => {
    if (!apiBase || viewTracked.current) return
    viewTracked.current = true
    fetch(`${apiBase}/views`, { method: "POST" }).catch(() => null)
  }, [apiBase])

  const toggleReaction = useCallback(async (emoji: string, idx: number) => {
    if (!apiBase) {
      // Local-only toggle for non-announcement posts
      setReactions((prev) =>
        prev.map((r, i) =>
          i === idx
            ? { ...r, reactedByMe: !r.reactedByMe, count: r.reactedByMe ? r.count - 1 : r.count + 1 }
            : r
        )
      )
      return
    }

    const isActive = reactions[idx]?.reactedByMe ?? false
    const action = isActive ? "remove" : "add"

    // Optimistic
    setReactions((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, reactedByMe: !r.reactedByMe, count: r.reactedByMe ? r.count - 1 : r.count + 1 }
          : r
      )
    )

    try {
      const res = await fetch(`${apiBase}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, action }),
      })
      if (res.ok) {
        const data = await res.json() as { counts: ReactionCount[]; mine: string[] }
        setReactions((prev) =>
          prev.map((r) => {
            const apiCount = data.counts.find((c) => c.emoji === r.emoji)
            return {
              ...r,
              count: apiCount?.total_count ?? r.count,
              reactedByMe: data.mine.includes(r.emoji),
            }
          })
        )
      }
    } catch {
      // revert
      setReactions((prev) =>
        prev.map((r, i) =>
          i === idx
            ? { ...r, reactedByMe: isActive, count: isActive ? r.count + 1 : r.count - 1 }
            : r
        )
      )
    }
  }, [apiBase, reactions])

  const showScoreBlock = post.kind === "game_result"
  const showMedia = !showScoreBlock && Boolean(post.mediaPlaceholder)

  const chipKind = post.pinned
    ? "coach_announcement"
    : post.kind === "game_result"
      ? "game_result"
      : post.kind === "coach_video"
        ? "coach_video"
        : post.kind === "team_update"
          ? "team_update"
          : null

  const openSheet = () => {
    if (!isAnnouncement) return
    setScrollToComments(false)
    setSheetOpen(true)
  }

  const openComments = (e: React.MouseEvent) => {
    if (!isAnnouncement) return
    e.stopPropagation()
    setScrollToComments(true)
    setSheetOpen(true)
  }

  return (
    <>
      <article
        className={cn(
          "overflow-hidden rounded-[22px] border",
          "bg-gradient-to-b from-[#13234E] to-[#0E1B3E]",
          "border-[rgba(125,155,255,0.14)]",
          post.kind === "game_result" || post.pinned
            ? "shadow-[0_22px_60px_-28px_rgba(255,100,40,0.45)]"
            : "",
          isAnnouncement && "cursor-pointer"
        )}
        onClick={openSheet}
        role={isAnnouncement ? "button" : undefined}
        tabIndex={isAnnouncement ? 0 : undefined}
        onKeyDown={isAnnouncement ? (e) => { if (e.key === "Enter" || e.key === " ") openSheet() } : undefined}
      >
        {/* header */}
        <div className="flex items-center gap-[10px] px-[14px] pb-[10px] pt-[14px]">
          <Avatar label={post.authorLabel} role={post.authorRole} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-[6px]">
              <span className="text-[13.5px] font-bold text-[#EEF3FF]">{post.authorLabel}</span>
              {chipKind ? <FeedKindBadge kind={chipKind} pinned={post.pinned} /> : null}
            </div>
            <p className="mt-[2px] text-[10.5px] font-medium text-[#92A5CC]">
              {post.authorSubtitle ?? post.timeLabel}
            </p>
          </div>
        </div>

        {/* body */}
        {post.body ? (
          <p className="px-[14px] pb-[11px] text-[13.5px] leading-[1.55] text-[#DDE6FA]">
            {post.body}
          </p>
        ) : null}

        {/* media */}
        {showScoreBlock ? (
          <div className="px-[14px] pb-[11px]"><ScoreBlock /></div>
        ) : showMedia ? (
          <div className="px-[14px] pb-[11px]"><FeedMediaPlaceholder variant={post.mediaPlaceholder} /></div>
        ) : null}

        {/* reactions row */}
        {reactions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-[8px] px-[14px] pb-[10px] pt-[2px]">
            {reactions.map((r, i) => (
              <ReactionPill
                key={r.emoji}
                emoji={r.emoji}
                count={r.count}
                active={r.reactedByMe ?? false}
                onToggle={() => void toggleReaction(r.emoji, i)}
              />
            ))}
            <span className="flex-1" />

            {/* comment icon — opens sheet at comments */}
            <button
              type="button"
              onClick={openComments}
              className={cn(
                "inline-flex items-center gap-[6px] text-[12px] font-semibold text-[#92A5CC] transition hover:text-[#EEF3FF]",
                !isAnnouncement && "cursor-default opacity-50"
              )}
              aria-label="Comments"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {commentCount > 0 ? commentCount : null}
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-[#92A5CC]"
              aria-label="Share"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          </div>
        ) : null}

        {/* seen by + reaction summary footer */}
        {(viewCount > 0 || post.reactionSummary) ? (
          <div
            className="flex items-center gap-[7px] border-t border-[rgba(125,155,255,0.14)] px-[14px] py-[9px] text-[11px] text-[#92A5CC]"
            onClick={(e) => e.stopPropagation()}
          >
            {viewCount > 0 && (
              <span className="flex items-center gap-[4px] text-[11px] text-[#92A5CC]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                {viewCount} saw this
              </span>
            )}
            {viewCount > 0 && post.reactionSummary ? <span>·</span> : null}
            {post.reactionSummary ? (
              <div className="flex items-center gap-[7px]">
                <div className="flex items-center">
                  {["#2C4E9E", "#1E6FD9", "#7A4AE0"].map((c, i) => (
                    <span
                      key={i}
                      className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[#0B1B4A] text-[8px] font-black text-white"
                      style={{ background: c, marginLeft: i === 0 ? 0 : -7 }}
                    >
                      {["JR", "MT", "DK"][i]}
                    </span>
                  ))}
                </div>
                {post.reactionSummary}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>

      {/* Detail sheet — rendered via portal when open */}
      {sheetOpen && isAnnouncement && (
        <AnnouncementDetailSheet
          announcementId={post.announcementId!}
          teamId={teamId}
          authorLabel={post.authorLabel}
          authorRole={post.authorRole}
          authorSubtitle={post.authorSubtitle}
          title={post.title}
          body={post.body}
          scrollToComments={scrollToComments}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  )
}
