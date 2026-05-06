"use client"

import { ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessageBubble } from "@/components/portal/messaging/MessageBubble"
import type { Message } from "@/components/portal/messaging/types"

export function MessageViewport({
  messages,
  messagesLoading,
  userId,
  canModerate,
  onModerateMessage,
  containerRef,
  endRef,
  showJumpToNewest,
  unreadCount,
  onJumpToNewest,
}: {
  messages: Message[]
  messagesLoading: boolean
  userId: string
  canModerate: boolean
  onModerateMessage: (messageId: string) => void
  containerRef: React.RefObject<HTMLDivElement>
  endRef: React.RefObject<HTMLDivElement>
  showJumpToNewest: boolean
  unreadCount: number
  onJumpToNewest: () => void
}) {
  // TODO(phase-3): swap list rendering to react-virtual once message row measurement is stabilized.
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={containerRef} className="messages-container min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
        {messagesLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--accent))] border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p style={{ color: "rgb(var(--muted))" }}>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.creator.id === userId}
              canModerate={canModerate}
              onModerate={onModerateMessage}
            />
          ))
        )}
        <div ref={endRef} />
      </div>
      {showJumpToNewest ? (
        <div className="pointer-events-none absolute bottom-3 right-4 z-20 md:bottom-4 md:right-5">
          <Button
            type="button"
            onClick={onJumpToNewest}
            size="sm"
            className="pointer-events-auto rounded-full px-4 py-2 shadow-lg"
            style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
          >
            <ArrowDown className="mr-2 inline h-4 w-4 align-middle" />
            {unreadCount > 0 ? `${unreadCount} new message${unreadCount !== 1 ? "s" : ""}` : "Jump to latest"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
