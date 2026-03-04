import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { ComplianceEventType } from "@/lib/audit/compliance-config"

type LogComplianceEventInput = {
  userId: string
  role?: string | null
  eventType: ComplianceEventType
  policyVersion: string
  ipAddress?: string | null
  metadata?: Record<string, unknown>
}

export async function logComplianceEvent(input: LogComplianceEventInput) {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase.from("compliance_log").insert({
    user_id: input.userId,
    event_type: input.eventType,
    policy_version: input.policyVersion,
    ip_address: input.ipAddress ?? null,
    metadata: {
      role: input.role ?? null,
      ...(input.metadata || {}),
    },
  }).select().single()

  if (error) throw error
  return data
}
