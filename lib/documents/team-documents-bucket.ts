import type { SupabaseClient } from "@supabase/supabase-js"

export const TEAM_DOCUMENTS_BUCKET = "team-documents"

export function sanitizeTeamDocumentFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_")
  return (base.length > 0 ? base.slice(0, 180) : "file") || "file"
}

export function buildTeamDocumentStoragePath(input: {
  orgId: string | null
  teamId: string
  documentId: string
  safeFileName: string
}): string {
  const orgSeg = input.orgId ?? "no-org"
  return `orgs/${orgSeg}/teams/${input.teamId}/documents/${input.documentId}-${input.safeFileName}`
}

export async function uploadTeamDocumentToStorage(
  supabase: SupabaseClient,
  path: string,
  body: Buffer,
  contentType: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(TEAM_DOCUMENTS_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  })
  if (error) {
    return { error: error.message }
  }
  return { error: null }
}

export async function downloadTeamDocumentFromStorage(
  supabase: SupabaseClient,
  path: string
): Promise<{ data: Buffer | null; error: string | null }> {
  const { data, error } = await supabase.storage.from(TEAM_DOCUMENTS_BUCKET).download(path)
  if (error || !data) {
    return { data: null, error: error?.message ?? "Download failed" }
  }
  const buf = Buffer.from(await data.arrayBuffer())
  return { data: buf, error: null }
}

export async function removeTeamDocumentFromStorage(supabase: SupabaseClient, path: string): Promise<void> {
  await supabase.storage.from(TEAM_DOCUMENTS_BUCKET).remove([path])
}
