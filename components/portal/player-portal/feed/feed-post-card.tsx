"use client"

import Link from "next/link"
import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import { FeedKindBadge } from "@/components/portal/player-portal/feed/feed-kind-badge"
import { FeedMediaPlaceholder } from "@/components/portal/player-portal/feed/feed-media-placeholder"
import { braikPlayerChrome } from "@/components/portal/player-portal/braik-player-visual-tokens"
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"
import { cn } from "@/lib/utils"

function Avatar({ label }: { label: string }) {
  const initial = label.trim().charAt(0).toUpperCase() || "?"
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-lg shadow-orange-900/25 ring-2 ring-white",
        braikPlayerChrome.avatarRing
      )}
    >
      {initial}
    </div>
  )
}

export function FeedPostCard({
  post,
  accountBasePath,
}: {
  post: PlayerFeedPost
  /** e.g. `/player/abc123` — used to resolve relative CTAs */
  accountBasePath: string
}) {
  const resolveHref = (href: string) =>
    href.startsWith("/player/") ? href : `${accountBasePath}${href.startsWith("/") ? href : `/${href}`}`

  const showMedia = post.kind !== "coach_announcement"

  const emphasis = post.pinned || post.kind === "game_result"

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[1.35rem] border border-slate-700/70 bg-[#0a1220] shadow-[0_10px_30px_-14px_rgba(0,0,0,0.8)] ring-1 ring-slate-700/40",
        emphasis &&
          "shadow-[0_16px_40px_-14px_rgba(248,88,8,0.32)] ring-1 ring-[#F85808]/45"
      )}
    >
      <div className="flex gap-3 border-b border-slate-700/60 px-4 pb-3 pt-4">
        <Avatar label={post.authorLabel} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("truncate font-bold", braikPlayerTheme.textWarm)}>{post.authorLabel}</span>
            <FeedKindBadge kind={post.kind} />
            {post.coachBadgeLabel ? (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-100">
                {post.coachBadgeLabel}
              </span>
            ) : null}
            {post.announcementBadge ? (
              <span className="rounded-full bg-[#F85808]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F8F8E8]">
                Announcement
              </span>
            ) : null}
            {post.pinned ? (
              <span className="rounded-full bg-[#D83808]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F8F8E8]">
                Pinned
              </span>
            ) : null}
          </div>
          {post.authorSubtitle ? (
            <p className="text-[13px] font-medium text-slate-400">{post.authorSubtitle}</p>
          ) : null}
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{post.timeLabel}</p>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-3">
        {post.title ? (
          <h3 className={cn("text-[1.07rem] font-black leading-snug tracking-tight", braikPlayerTheme.textWarm)}>{post.title}</h3>
        ) : null}
        {post.highlightMeta ? (
          <p className="rounded-xl bg-gradient-to-r from-[#3b1608] via-[#4a1d0b] to-[#351307] px-3 py-2 text-sm font-semibold text-[#F8F8E8] ring-1 ring-[#F85808]/30">
            {post.highlightMeta}
          </p>
        ) : null}
        {post.visibilityLabel ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{post.visibilityLabel}</p>
        ) : null}
        {post.body ? (
          <p className="text-[15px] leading-relaxed text-slate-300">{post.body}</p>
        ) : null}

        {showMedia ? <FeedMediaPlaceholder variant={post.mediaPlaceholder} /> : null}

        {post.reactionSummary ? (
          <p className="text-sm font-semibold text-slate-400">{post.reactionSummary}</p>
        ) : null}

        <div className="flex gap-4 border-t border-slate-700/60 pt-3">
          {post.cta ? (
            <Link
              href={resolveHref(post.cta.href)}
              prefetch={false}
              className="text-sm font-semibold text-slate-200 hover:text-white"
            >
              {post.cta.label}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-slate-400">Details</span>
          )}
          <button
            type="button"
            className="text-sm font-semibold text-[#F85808] hover:text-[#D83808]"
            aria-label="Reactions coming soon"
          >
            React
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-slate-300 hover:text-slate-100"
            aria-label="Reply coming soon"
          >
            Reply
          </button>
        </div>
      </div>
    </article>
  )
}
