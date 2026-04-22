"use client"

import Link from "next/link"
import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import { FeedKindBadge } from "@/components/portal/player-portal/feed/feed-kind-badge"
import { FeedMediaPlaceholder } from "@/components/portal/player-portal/feed/feed-media-placeholder"
import { braikPlayerChrome } from "@/components/portal/player-portal/braik-player-visual-tokens"
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

  const showMedia =
    post.kind !== "motivation" &&
    post.kind !== "study_teaser" &&
    post.kind !== "pinned_reminder"

  const emphasis = post.pinned || post.kind === "game_day"

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.03]",
        emphasis &&
          "shadow-[0_16px_40px_-14px_rgba(14,165,233,0.35)] ring-1 ring-sky-400/40"
      )}
    >
      <div className="flex gap-3 border-b border-slate-100/80 px-4 pt-4 pb-3">
        <Avatar label={post.authorLabel} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-bold text-slate-900">{post.authorLabel}</span>
            <FeedKindBadge kind={post.kind} />
          </div>
          {post.authorSubtitle ? (
            <p className="text-[13px] font-medium text-slate-500">{post.authorSubtitle}</p>
          ) : null}
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{post.timeLabel}</p>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-3">
        {post.title ? (
          <h3 className="text-[1.07rem] font-black leading-snug tracking-tight text-slate-900">{post.title}</h3>
        ) : null}
        {post.highlightMeta ? (
          <p className="rounded-xl bg-gradient-to-r from-sky-50 via-amber-50 to-orange-50 px-3 py-2 text-sm font-semibold text-orange-950 ring-1 ring-orange-500/20">
            {post.highlightMeta}
          </p>
        ) : null}
        {post.body ? (
          <p className="text-[15px] leading-relaxed text-slate-600">{post.body}</p>
        ) : null}

        {(showMedia || post.kind === "pinned_reminder") && (
          <FeedMediaPlaceholder variant={post.mediaPlaceholder} />
        )}

        {post.reactionSummary ? (
          <p className="text-sm font-semibold text-slate-500">{post.reactionSummary}</p>
        ) : null}

        {post.cta ? (
          <Link
            href={resolveHref(post.cta.href)}
            prefetch={false}
            className={cn(
              "inline-flex w-full items-center justify-center rounded-2xl py-3.5 text-[15px] font-bold text-white shadow-lg shadow-orange-900/30 transition active:scale-[0.98]",
              braikPlayerChrome.ctaButton
            )}
          >
            {post.cta.label}
          </Link>
        ) : (
          post.kind !== "motivation" && (
            <div className="flex gap-4 border-t border-slate-100 pt-3">
              <button
                type="button"
                className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                aria-label="React with fire — coming soon"
              >
                🔥 Tap in
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-slate-400"
                aria-label="Comments coming soon"
                disabled
              >
                Comments soon
              </button>
            </div>
          )
        )}
      </div>
    </article>
  )
}
