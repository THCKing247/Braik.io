import { getSupabaseServer } from "@/src/lib/supabaseServer"

interface AdminAuditInput {
  actorId: string
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export async function writeAdminAuditLog(input: AdminAuditInput): Promise<void> {
  const supabase = getSupabaseServer()
  await supabase.from("audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? null,
  })
}
