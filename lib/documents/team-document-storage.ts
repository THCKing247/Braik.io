import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getUploadRoot } from "@/lib/upload-path"
import { downloadTeamDocumentFromStorage } from "@/lib/documents/team-documents-bucket"

/**
 * Resolve disk path for team documents stored under /api/uploads/team-documents/...
 */
export function getTeamDocumentDiskPath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl || !fileUrl.startsWith("/api/uploads/")) {
    return null
  }
  const rest = fileUrl.replace(/^\/api\/uploads\//, "")
  const segments = rest.split("/").filter(Boolean)
  if (segments.length === 0) return null
  return join(getUploadRoot(), "uploads", ...segments)
}

function contentTypeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase()
  const types: Record<string, string> = {
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
  return types[ext || ""] || "application/octet-stream"
}

export async function readTeamDocumentFromUrl(
  fileUrl: string | null | undefined,
  mimeType: string | null | undefined
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const diskPath = getTeamDocumentDiskPath(fileUrl)
  if (!diskPath || !existsSync(diskPath)) {
    return null
  }
  const buffer = await readFile(diskPath)
  const contentType =
    mimeType && mimeType.trim().length > 0 ? mimeType : contentTypeFromPath(diskPath)
  return { buffer, contentType }
}

/**
 * Load bytes for a team document row: private Storage first, then legacy local disk via file_url.
 */
export async function loadTeamDocumentContent(
  supabase: SupabaseClient,
  row: {
    file_path?: string | null
    file_url?: string | null
    mime_type?: string | null
  }
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const storagePath = row.file_path?.trim()
  if (storagePath) {
    const { data, error } = await downloadTeamDocumentFromStorage(supabase, storagePath)
    if (error || !data) {
      return null
    }
    const contentType =
      row.mime_type && row.mime_type.trim().length > 0 ? row.mime_type : "application/octet-stream"
    return { buffer: data, contentType }
  }
  return readTeamDocumentFromUrl(row.file_url, row.mime_type)
}
