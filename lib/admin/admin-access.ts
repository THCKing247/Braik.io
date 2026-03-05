import { getServerSession } from "@/lib/auth/server-auth"
import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"

export interface AdminAccessContext {
  actorId: string
  actorEmail: string
}

export async function getAdminAccessForApi(): Promise<
  { ok: true; context: AdminAccessContext } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession()
  if (!session?.user?.id || !session.user.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const sessionUserId = session.user.id
  const sessionEmail = session.user.email
  const isBootstrapAdminSession = sessionUserId.startsWith("bootstrap-admin:")
  if (isBootstrapAdminSession) {
    return {
      ok: true,
      context: {
        actorId: sessionUserId,
        actorEmail: sessionEmail,
      },
    }
  }

  const supabase = getSupabaseServer()
  const { data: user } = await supabase
    .from("users")
    .select("id, role, status, email")
    .eq("id", sessionUserId)
    .maybeSingle()

  const isAdminFromUsers = typeof user?.role === "string" && user.role.toLowerCase() === "admin"
  const isPlatformOwner = session.user.isPlatformOwner === true
  if (user?.status === "DISABLED") {
    if (session.user.id) {
      await writeAdminAuditLog({
        actorId: session.user.id,
        action: "admin_access_denied",
        targetType: "api",
        targetId: "admin_api",
        metadata: { reason: "disabled" },
      }).catch(() => undefined)
    }
    return {
      ok: false,
      response: NextResponse.json({ error: "Access denied: Admin only" }, { status: 403 }),
    }
  }
  if (isAdminFromUsers || isPlatformOwner) {
    return {
      ok: true,
      context: {
        actorId: sessionUserId,
        actorEmail: user?.email ?? sessionEmail,
      },
    }
  }

  // Fallback: check profiles when users row is missing or not admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", sessionUserId)
    .maybeSingle()
  if (isAdminProfileRole(profile?.role)) {
    return {
      ok: true,
      context: {
        actorId: sessionUserId,
        actorEmail: sessionEmail,
      },
    }
  }

  if (session.user.id) {
    await writeAdminAuditLog({
      actorId: session.user.id,
      action: "admin_access_denied",
      targetType: "api",
      targetId: "admin_api",
      metadata: { reason: "non_admin_role_or_disabled" },
    }).catch(() => undefined)
  }
  return {
    ok: false,
    response: NextResponse.json({ error: "Access denied: Admin only" }, { status: 403 }),
  }
}

/** Profile roles that grant admin access (matches login redirect logic). */
function isAdminProfileRole(role: string | null | undefined): boolean {
  if (!role || typeof role !== "string") return false
  const r = role.trim().toLowerCase()
  return r === "admin" || r === "school_admin"
}

export async function hasAdminAccess(userId: string, _email?: string | null): Promise<boolean> {
  if (userId.startsWith("bootstrap-admin:")) {
    return true
  }

  const supabase = getSupabaseServer()
  const { data: user } = await supabase
    .from("users")
    .select("role, status, is_platform_owner")
    .eq("id", userId)
    .maybeSingle()

  const isAdminFromUsers = typeof user?.role === "string" && user.role.toLowerCase() === "admin"
  const isPlatformOwner = (user as { is_platform_owner?: boolean } | null)?.is_platform_owner === true
  if (user?.status === "DISABLED") {
    return false
  }
  if (isAdminFromUsers || isPlatformOwner) {
    return true
  }

  // Fallback: users row may be missing or out of sync (e.g. upsert failed at login). Check profiles.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  return isAdminProfileRole(profile?.role) === true
}
