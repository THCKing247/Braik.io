import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/** Impersonation session type (cookie-based signed token until DB table exists) */
export type ImpersonationSession = {
  id: string
  actor_admin_id: string
  target_user_id: string
  target_team_id: string | null
  active: boolean
  expires_at: string
}

const IMPERSONATION_COOKIE = "braik_support_token"
const DEFAULT_MAX_AGE_SEC = 60 * 60 // 1 hour

function getImpersonationSecret(): string {
  return process.env.IMPERSONATION_SECRET || process.env.SECRET || "braik-impersonation-dev-secret"
}

/** Create a signed impersonation token (payload + HMAC). */
export function createImpersonationToken(params: {
  adminId: string
  targetUserId: string
  maxAgeSec?: number
}): string {
  const { adminId, targetUserId, maxAgeSec = DEFAULT_MAX_AGE_SEC } = params
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec
  const payload = JSON.stringify({ adminId, targetUserId, exp })
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url")
  const secret = getImpersonationSecret()
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url")
  return `${payloadB64}.${sig}`
}

/** Verify token and return session or null. */
export async function getActiveImpersonationFromToken(rawToken?: string | null): Promise<ImpersonationSession | null> {
  if (!rawToken || typeof rawToken !== "string") return null
  const parts = rawToken.split(".")
  if (parts.length !== 2) return null
  const [payloadB64, sig] = parts
  const secret = getImpersonationSecret()
  const expectedSig = createHmac("sha256", secret).update(payloadB64).digest("base64url")
  if (expectedSig.length !== sig.length || !timingSafeEqual(Buffer.from(expectedSig, "utf8"), Buffer.from(sig, "utf8"))) {
    return null
  }
  let payload: { adminId?: string; targetUserId?: string; exp?: number }
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"))
  } catch {
    return null
  }
  const { adminId, targetUserId, exp } = payload
  if (!adminId || !targetUserId || typeof exp !== "number" || exp < Math.floor(Date.now() / 1000)) {
    return null
  }
  return {
    id: `imp-${adminId}-${targetUserId}`,
    actor_admin_id: adminId,
    target_user_id: targetUserId,
    target_team_id: null,
    active: true,
    expires_at: new Date(exp * 1000).toISOString(),
  }
}

/** Build Set-Cookie value for impersonation token. */
export function impersonationCookieHeader(token: string, maxAgeSec: number = DEFAULT_MAX_AGE_SEC): string {
  return `${IMPERSONATION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`
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
