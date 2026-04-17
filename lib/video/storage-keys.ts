import { randomUUID } from "crypto"

export function sanitizeVideoFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_")
  return (base.length > 0 ? base.slice(0, 180) : "video") || "video"
}

export function buildGameVideoStorageKey(input: {
  teamId: string
  videoId: string
  safeFileName: string
}): string {
  return `teams/${input.teamId}/game-film/${input.videoId}/${input.safeFileName}`
}

export function buildThumbnailStorageKey(teamId: string, videoId: string): string {
  return `teams/${teamId}/game-film/${videoId}/thumb-${randomUUID()}.jpg`
}
