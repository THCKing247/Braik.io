"use client"

import { ThreadInboxRow } from "@/components/portal/messaging/ThreadInboxRow"
import type { Thread } from "@/components/portal/messaging/types"

export function ThreadInboxList({
  starred,
  rest,
  priorityCollapsed,
  onTogglePriorityCollapsed,
  selectedThreadId,
  userId,
  starredThreadIds,
  onSelectThread,
  onToggleStar,
}: {
  starred: Thread[]
  rest: Thread[]
  priorityCollapsed: boolean
  onTogglePriorityCollapsed: () => void
  selectedThreadId?: string
  userId: string
  starredThreadIds: Set<string>
  onSelectThread: (thread: Thread) => void
  onToggleStar: (threadId: string, e: React.MouseEvent) => void
}) {
  return (
    <>
      {starred.length > 0 ? (
        <div className="mb-1">
          <button
            type="button"
            onClick={onTogglePriorityCollapsed}
            className="sticky top-0 z-[1] mb-2 flex w-full items-center justify-between bg-white/95 px-4 py-2 text-left backdrop-blur-sm md:px-5"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-[rgb(var(--muted))]">Priority · Starred</span>
            <span className="text-xs text-[rgb(var(--accent))]">{priorityCollapsed ? "Show" : "Hide"}</span>
          </button>
          {!priorityCollapsed
            ? starred.map((t) => (
                <ThreadInboxRow
                  key={t.id}
                  thread={t}
                  userId={userId}
                  isSelected={selectedThreadId === t.id}
                  isStarred={starredThreadIds.has(t.id)}
                  onSelect={onSelectThread}
                  onToggleStar={onToggleStar}
                />
              ))
            : null}
        </div>
      ) : null}

      <div className="mt-1">
        {rest.length > 0 ? (
          <h3 className="sticky top-0 z-[1] mb-2 bg-white/95 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[rgb(var(--muted))] backdrop-blur-sm md:px-5">
            All threads
          </h3>
        ) : null}
        {rest.map((t) => (
          <ThreadInboxRow
            key={t.id}
            thread={t}
            userId={userId}
            isSelected={selectedThreadId === t.id}
            isStarred={starredThreadIds.has(t.id)}
            onSelect={onSelectThread}
            onToggleStar={onToggleStar}
          />
        ))}
      </div>
    </>
  )
}
