/**
 * Application-level attachment shape for thread UI (no DB migration).
 * Optional thumbnail URL/path when backend adds it to metadata later.
 */
export type ThreadMessageAttachment = {
  id?: string
  fileName?: string
  fileUrl?: string
  mimeType?: string
  fileSize?: number
  /** Optional preview URL when server stores a smaller derivative */
  thumbnailUrl?: string
  /** Escape hatch for JSON metadata without schema churn */
  metadata?: { thumbnailUrl?: string } | null
}

export function attachmentThumbnailSrc(att: ThreadMessageAttachment): string | undefined {
  const m = att.metadata
  return att.thumbnailUrl ?? (m && typeof m === "object" ? m.thumbnailUrl : undefined)
}
