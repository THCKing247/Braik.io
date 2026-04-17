/** Allowed master video uploads (browser-friendly set). */
export const VIDEO_UPLOAD_ALLOWED_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
] as const

export const VIDEO_UPLOAD_MAX_BYTES_SINGLE_PUT = 5 * 1024 * 1024 * 1024 // 5 GiB — practical single PUT ceiling

/** Above this size, clients should use multipart upload (presigned parts). */
export const VIDEO_MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024 // 100 MiB

/** S3 multipart part size (aligned with common R2 usage). */
export const VIDEO_MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024 // 8 MiB

export const VIDEO_SIGNED_URL_TTL_SECONDS = 3600

export function inferMimeFromFileName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
  }
  return map[ext] ?? null
}
