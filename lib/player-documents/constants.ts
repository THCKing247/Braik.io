/** Exact consent copy required at upload (matches DB consent_text for new rows). */
export const PLAYER_DOCUMENT_CONSENT_TEXT =
  "I consent to storing and sharing this document with authorized team staff (coaches, administrators) for participation purposes."

/** Shown near the upload control in the portal UI. */
export const PLAYER_DOCUMENT_UPLOAD_HELPER =
  "Documents are stored securely and shared only with authorized team staff for participation purposes. Documents may automatically expire after 365 days based on season retention settings."

export const DOCUMENT_TYPES = ["physical", "waiver", "permission_slip", "other"] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const SIGNED_URL_TTL_SECONDS = 300

export const DEFAULT_RETENTION_DAYS = 365

export const ALLOWED_PLAYER_DOC_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const

export const MAX_PLAYER_DOC_BYTES = 15 * 1024 * 1024
