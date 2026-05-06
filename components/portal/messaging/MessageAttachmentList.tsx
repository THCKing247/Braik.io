"use client"

import { memo, useMemo } from "react"
import type { ThreadMessageAttachment } from "@/lib/messaging/attachment-display-types"
import { attachmentThumbnailSrc } from "@/lib/messaging/attachment-display-types"
import { messageAttachmentIsImage } from "@/components/portal/messaging/messaging-display-utils"
import { LazyThreadAttachmentImage } from "@/components/portal/messaging/LazyThreadAttachmentImage"

function formatBytes(n?: number): string | undefined {
  if (n == null || !Number.isFinite(n) || n < 0) return undefined
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function attachmentSignature(att: ThreadMessageAttachment, idx: number): string {
  return [
    att.id ?? "",
    att.fileUrl ?? "",
    att.mimeType ?? "",
    String(att.fileSize ?? ""),
    attachmentThumbnailSrc(att) ?? "",
    idx,
  ].join("|")
}

export const MessageAttachmentList = memo(
  function MessageAttachmentList({ attachments }: { attachments: ThreadMessageAttachment[] }) {
    const items = useMemo(() => (Array.isArray(attachments) ? attachments : []), [attachments])

    if (items.length === 0) return null

    return (
      <div className="mt-2 space-y-2">
        {items.map((att: ThreadMessageAttachment, idx: number) => {
          const fullSrc = att?.id
            ? `/api/messages/attachments/${att.id}`
            : `/api/messages/attachments/serve?fileUrl=${encodeURIComponent(att?.fileUrl || "")}`
          const fileName = String(att?.fileName || `Attachment ${idx + 1}`)
          const thumb = attachmentThumbnailSrc(att)
          const sizeLabel = formatBytes(att.fileSize)

          if (messageAttachmentIsImage(att)) {
            return (
              <LazyThreadAttachmentImage
                key={attachmentSignature(att, idx)}
                fullSrc={fullSrc}
                thumbnailSrc={thumb}
                alt={fileName}
              />
            )
          }

          return (
            <div
              key={attachmentSignature(att, idx)}
              className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-2 text-xs"
            >
              <a
                href={fullSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[rgb(var(--accent))] underline-offset-2 hover:underline"
              >
                {fileName}
              </a>
              <div className="mt-0.5 space-x-2 text-[11px] text-muted-foreground">
                {att.mimeType ? <span>{att.mimeType}</span> : null}
                {sizeLabel ? <span>{sizeLabel}</span> : null}
              </div>
            </div>
          )
        })}
      </div>
    )
  },
  (prev, next) => {
    const a = prev.attachments
    const b = next.attachments
    if (a === b) return true
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (attachmentSignature(a[i] as ThreadMessageAttachment, i) !== attachmentSignature(b[i] as ThreadMessageAttachment, i)) {
        return false
      }
    }
    return true
  }
)
