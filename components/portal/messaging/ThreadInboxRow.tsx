"use client"

import { memo, type KeyboardEvent, type MouseEvent } from "react"
import { format } from "date-fns"
import { Lock, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  avatarClassForKind,
  displayNameForParticipantUser,
  getThreadDisplayName,
  primaryThreadPeer,
  threadCategoryLabel,
} from "@/components/portal/messaging/messaging-row-utils"
import { initialsFromDisplayName } from "@/components/portal/messaging/messaging-display-utils"
import type { Thread } from "@/components/portal/messaging/types"

export const ThreadInboxRow = memo(function ThreadInboxRow({
  thread,
  userId,
  isSelected,
  isStarred,
  onSelect,
  onToggleStar,
}: {
  thread: Thread
  userId: string
  isSelected: boolean
  isStarred: boolean
  onSelect: (thread: Thread) => void
  onToggleStar: (threadId: string, e: MouseEvent) => void
}) {
  const lastMessage = thread.messages[0]
  const isReadOnly = thread.isReadOnly || false
  const peer = primaryThreadPeer(thread, userId)
  const peerName = peer ? displayNameForParticipantUser(peer.user) : getThreadDisplayName(thread, userId)
  const peerKind = peer?.participantKind
  const initials = initialsFromDisplayName(peerName)
  const unread = (thread.unreadCount ?? 0) > 0

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onSelect(thread)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onSelect(thread)}
      className={cn(
        "relative mx-3 mb-3 cursor-pointer rounded-2xl border p-4 text-left shadow-sm transition-all md:mx-4 md:mb-3 md:p-4 lg:rounded-2xl lg:p-4",
        isSelected
          ? "border-[rgb(var(--accent))] bg-[rgb(var(--platinum))] ring-1 ring-[rgb(var(--accent))]/25"
          : "border-[rgb(var(--border))] bg-white hover:border-[rgb(var(--accent))]/40"
      )}
      style={{ borderColor: isSelected ? undefined : "rgb(var(--border))" }}
    >
      <button
        type="button"
        aria-label={isStarred ? "Remove from priority" : "Mark as priority"}
        className="absolute right-3 top-3 rounded-full p-1.5 text-[rgb(var(--muted))] transition hover:bg-black/5 hover:text-[rgb(var(--accent))]"
        onClick={(e) => onToggleStar(thread.id, e)}
      >
        <Star className={cn("h-5 w-5", isStarred && "fill-amber-400 text-amber-500")} strokeWidth={isStarred ? 0 : 1.75} />
      </button>
      <div className="flex gap-3 pr-10">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold", avatarClassForKind(peerKind))}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate pr-2 text-[15px] font-semibold leading-tight text-[rgb(var(--text))]">
              {getThreadDisplayName(thread, userId)}
            </h3>
          </div>
          {lastMessage ? (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-[rgb(var(--text2))]">
              <span className="font-medium text-[rgb(var(--text))]">{lastMessage.creator.name || lastMessage.creator.email}:</span>{" "}
              {lastMessage.body}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-[rgb(var(--muted))]">No messages yet</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
              {threadCategoryLabel(thread, userId)}
            </span>
            {isReadOnly ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-[rgb(var(--muted))]">
                <Lock className="h-3 w-3" /> Read-only
              </span>
            ) : null}
            {unread ? (
              <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[rgb(var(--accent))] px-2 py-0.5 text-[11px] font-semibold text-white">
                {(thread.unreadCount ?? 0) > 9 ? "9+" : thread.unreadCount}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
            <span className="truncate font-medium text-[rgb(var(--text2))]">{peerName}</span>
            <time className="shrink-0 tabular-nums">{format(new Date(thread.updatedAt), "MMM d, h:mm a")}</time>
          </div>
        </div>
      </div>
    </div>
  )
})
