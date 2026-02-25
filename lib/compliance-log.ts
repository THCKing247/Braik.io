import { prisma } from "@/lib/prisma"
import type { ComplianceEventType } from "@/lib/compliance-config"

type LogComplianceEventInput = {
  userId: string
  role?: string | null
  eventType: ComplianceEventType
  policyVersion: string
  ipAddress?: string | null
  metadata?: Record<string, unknown>
}

export async function logComplianceEvent(input: LogComplianceEventInput) {
  return prisma.complianceLog.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      policyVersion: input.policyVersion,
      ipAddress: input.ipAddress || null,
      metadata: {
        role: input.role || null,
        ...(input.metadata || {}),
      },
    },
  })
}
