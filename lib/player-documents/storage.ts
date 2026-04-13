import { MAX_PLAYER_DOC_BYTES, ALLOWED_PLAYER_DOC_MIME_TYPES, SIGNED_URL_TTL_SECONDS } from "./constants"
import type { SupabaseClient } from "@supabase/supabase-js"

const BUCKET = "player-documents"

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_")
  return (base.length > 0 ? base.slice(0, 180) : "file") || "file"
}

export function buildPlayerDocumentStoragePath(input: {
  orgId: string | null
  teamId: string
  playerId: string
  documentType: string
  documentId: string
  safeFileName: string
}): string {
  const orgSeg = input.orgId ?? "no-org"
  return `orgs/${orgSeg}/teams/${input.teamId}/players/${input.playerId}/${input.documentType}/${input.documentId}-${input.safeFileName}`
}

function inferMimeFromFileName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    txt: "text/plain",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
  return map[ext] ?? null
}

export function assertMimeAndSize(
  mime: string | null,
  size: number,
  fileName?: string
): { ok: true; effectiveMime: string } | { ok: false; error: string } {
  if (size > MAX_PLAYER_DOC_BYTES) {
    return { ok: false, error: `File size exceeds ${MAX_PLAYER_DOC_BYTES / (1024 * 1024)}MB limit` }
  }
  let effective = (mime && mime.trim() ? mime : null) || (fileName ? inferMimeFromFileName(fileName) : null)
  if (!effective) {
    return { ok: false, error: "Could not determine file type. Rename the file with an extension (e.g. .pdf) or try another browser." }
  }
  if (!(ALLOWED_PLAYER_DOC_MIME_TYPES as readonly string[]).includes(effective)) {
    return { ok: false, error: "File type not allowed. Use PDF, images, or Word documents." }
  }
  return { ok: true, effectiveMime: effective }
}

export async function uploadPlayerDocumentToStorage(
  supabase: SupabaseClient,
  path: string,
  body: Buffer | Blob,
  contentType: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  })
  if (error) {
    return { error: error.message }
  }
  return { error: null }
}

export async function createSignedUrlForPath(
  supabase: SupabaseClient,
  path: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message ?? "Signed URL failed" }
  }
  return { url: data.signedUrl, error: null }
}

export async function removeStorageObject(supabase: SupabaseClient, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

export { BUCKET as PLAYER_DOCUMENTS_BUCKET }
