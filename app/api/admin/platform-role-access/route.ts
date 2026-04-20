import { NextResponse } from "next/server"
import { getAdminAccessForApi, hasLegacyAdminAccess } from "@/lib/admin/admin-access"
import { hasPermission, hasRole } from "@/lib/permissions/platform-permissions"
import type { PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"

export const runtime = "nodejs"

async function check(
  userId: string,
  email: string,
  key: PlatformPermissionKey
): Promise<boolean> {
  return hasPermission(userId, email, key)
}

/** Admin shell capabilities for nav and action gating (server-enforced on APIs separately). */
export async function GET() {
  const access = await getAdminAccessForApi()
  if (!access.ok) {
    return access.response
  }
  const { actorId, actorEmail } = access.context

  const [
    canManageRoles,
    canManageUsers,
    canImpersonate,
    canViewAuditLogs,
    canManagePlatformSettings,
    canViewBilling,
    canManageBilling,
    canUseDevConsole,
  ] = await Promise.all([
    check(actorId, actorEmail, "manage_roles_permissions"),
    check(actorId, actorEmail, "manage_users"),
    check(actorId, actorEmail, "impersonate_users"),
    check(actorId, actorEmail, "view_audit_logs"),
    check(actorId, actorEmail, "manage_platform_settings"),
    check(actorId, actorEmail, "view_billing"),
    check(actorId, actorEmail, "manage_billing"),
    (async () => {
      return (
        (await hasLegacyAdminAccess(actorId, actorEmail)) || (await hasRole(actorId, "platform_admin"))
      )
    })(),
  ])

  return NextResponse.json({
    ok: true,
    canManageRoles,
    canManageUsers,
    canImpersonate,
    canViewAuditLogs,
    canManagePlatformSettings,
    canViewBilling,
    canManageBilling,
    canUseDevConsole,
  })
}
