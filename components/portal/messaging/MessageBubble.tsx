"use client"

import { memo } from "react"
import { format } from "date-fns"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessageAttachmentList } from "@/components/portal/messaging/MessageAttachmentList"
import type { Message } from "@/components/portal/messaging/types"

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwnMessage,
  canModerate,
  onModerate,
}: {
  message: Message
  isOwnMessage: boolean
  canModerate: boolean
  onModerate: (messageId: string) => void
}) {
  const removed = message.isRemoved === true

  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[78%] rounded-2xl p-3"
        style={
          isOwnMessage
            ? { backgroundColor: "#0B2A5B", color: "#FFFFFF" }
            : {
                backgroundColor: "#FFFFFF",
                borderColor: "#3B82F6",
                borderWidth: "2px",
                borderStyle: "solid",
                color: "rgb(var(--text))",
              }
        }
      >
        <p className={`whitespace-pre-wrap text-sm ${removed ? "italic opacity-90" : ""}`}>{message.body}</p>
        <MessageAttachmentList attachments={Array.isArray(message.attachments) ? message.attachments : []} />
        <div className={`mt-2 flex items-center justify-between gap-2 ${isOwnMessage ? "opacity-80" : ""}`}>
          <p className="text-xs">
            {message.creator.name || message.creator.email} • {format(new Date(message.createdAt), "h:mm a")}
          </p>
          {canModerate && !removed ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => onModerate(message.id)}
              title="Remove message"
              style={isOwnMessage ? { color: "rgba(255,255,255,0.9)" } : { color: "rgb(var(--accent))" }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
})
