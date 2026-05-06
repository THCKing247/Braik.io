"use client"

import { memo } from "react"
import { messageAttachmentIsImage } from "@/components/portal/messaging/messaging-display-utils"
import { LazyThreadAttachmentImage } from "@/components/portal/messaging/LazyThreadAttachmentImage"

export const MessageAttachmentList = memo(function MessageAttachmentList({
  attachments,
}: {
  attachments: any[]
}) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null

  return (
    <div className="mt-2 space-y-1">
      {attachments.map((att: any, idx: number) => {
        const secureUrl = att?.id
          ? `/api/messages/attachments/${att.id}`
          : `/api/messages/attachments/serve?fileUrl=${encodeURIComponent(att?.fileUrl || "")}`
        const fileName = String(att?.fileName || `Attachment ${idx + 1}`)
        if (messageAttachmentIsImage(att)) {
          return <LazyThreadAttachmentImage key={`${secureUrl}:${idx}`} src={secureUrl} alt={fileName} />
        }
        return (
          <a
            key={`${secureUrl}:${idx}`}
            href={secureUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs underline"
          >
            📎 {fileName}
          </a>
        )
      })}
    </div>
  )
})
