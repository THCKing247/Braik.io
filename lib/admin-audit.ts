import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

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
  await prisma.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType || null,
      targetId: input.targetId || null,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
    },
  })
}
