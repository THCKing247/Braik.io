import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { getUploadRoot } from "@/lib/upload-path"

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
