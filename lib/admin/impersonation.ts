import { cookies } from "next/headers"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/** Impersonation session type (Supabase may add admin_impersonation_sessions table later) */
export type ImpersonationSession = {
  id: string
  actor_admin_id: string
  target_user_id: string
  target_team_id: string | null
  active: boolean
  expires_at: string
}

export async function getActiveImpersonationFromToken(_rawToken?: string | null): Promise<ImpersonationSession | null> {
  // Supabase schema does not yet include admin_impersonation_sessions; return null until table exists
  return null
}

export async function getActiveImpersonationFromCookies() {
  const cookieStore = cookies()
  const supportToken = cookieStore.get("braik_support_token")?.value || null
  return getActiveImpersonationFromToken(supportToken)
}

export function getSupportTokenFromRequestCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null
  }

  const cookieParts = cookieHeader.split(";")
  for (const part of cookieParts) {
    const [name, value] = part.trim().split("=")
    if (name === "braik_support_token") {
      return value || null
    }
  }

  return null
}

export async function auditImpersonatedActionFromRequest(
  request: Request,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supportToken = getSupportTokenFromRequestCookieHeader(request.headers.get("cookie"))
  const session = await getActiveImpersonationFromToken(supportToken)
  if (!session) {
    return
  }

  const supabase = getSupabaseServer()
  await supabase.from("audit_logs").insert({
    actor_id: (session as { actorAdminId?: string }).actorAdminId ?? (session as ImpersonationSession).actor_admin_id,
    action: `impersonation_${action}`,
    target_type: "user",
    target_id: (session as { targetUserId?: string }).targetUserId ?? (session as ImpersonationSession).target_user_id,
    metadata: {
      ...(metadata || {}),
    },
  })
}
