import { writeAuditLog } from "@/lib/audit/write-audit-log"

interface AdminAuditInput {
  actorId: string
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
  teamId?: string | null
}

export async function writeAdminAuditLog(input: AdminAuditInput): Promise<void> {
  const meta = { ...(input.metadata ?? {}) }
  if (input.ipAddress) meta.ipAddress = input.ipAddress
  if (input.userAgent) meta.userAgent = input.userAgent
  await writeAuditLog({
    actorUserId: input.actorId,
    teamId: input.teamId ?? null,
    actionType: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: Object.keys(meta).length ? meta : null,
  })
}
