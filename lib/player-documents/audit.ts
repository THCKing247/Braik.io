import type { SupabaseClient } from "@supabase/supabase-js"

export type DocumentAuditAction =
  | "upload"
  | "view"
  | "download"
  | "delete"
  | "restore"
  | "signed_url_generated"
  | "bulk_export"

export async function writeDocumentAuditLog(
  supabase: SupabaseClient,
  input: {
    documentId: string
    actorProfileId: string
    actorRole: string | null
    action: DocumentAuditAction
    accessMethod: "ui" | "api" | "admin_portal"
    ipAddress?: string | null
    userAgent?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await supabase.from("document_access_audit").insert({
    document_id: input.documentId,
    actor_profile_id: input.actorProfileId,
    actor_role: input.actorRole,
    action: input.action,
    access_method: input.accessMethod,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    metadata: input.metadata ?? {},
  })
  if (error) {
    console.error("[document_access_audit]", error.message)
  }
}
