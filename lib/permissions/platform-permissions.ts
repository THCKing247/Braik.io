import { NextResponse } from "next/server"
import { getAdminAccessForApi, hasLegacyAdminAccess, type AdminAccessContext } from "@/lib/admin/admin-access"
import {
  fetchPlatformPermissionKeysForUser,
  userHasPlatformPermission,
} from "@/lib/permissions/platform-permission-db"
import { PLATFORM_PERMISSION_KEYS, type PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

const ALL_KEYS_SET = new Set<PlatformPermissionKey>(PLATFORM_PERMISSION_KEYS)

/**
 * Legacy admins (allowlisted email, users.role admin, platform owner, etc.) implicitly have every permission.
 */
export async function hasPermission(
  userId: string,
  email: string | null | undefined,
  permission: PlatformPermissionKey
): Promise<boolean> {
  if (await hasLegacyAdminAccess(userId, email)) {
    return true
  }
  return userHasPlatformPermission(userId, permission)
}

export async function hasRole(userId: string, roleKey: string): Promise<boolean> {
  const supabase = getSupabaseServer()
  const { data: user } = await supabase
    .from("users")
    .select("platform_role_id")
    .eq("id", userId)
    .maybeSingle()

  const roleId = user?.platform_role_id as string | null | undefined
  if (!roleId) return false

  const { data: role } = await supabase.from("platform_roles").select("key").eq("id", roleId).maybeSingle()
  return (role as { key?: string } | null)?.key === roleKey
}

/** Full permission set for the user's platform role (empty if none); does not expand legacy admin. */
export async function getEffectivePermissionKeysForUser(userId: string): Promise<Set<PlatformPermissionKey>> {
  if (await hasLegacyAdminAccess(userId, null)) {
    return ALL_KEYS_SET
  }
  return fetchPlatformPermissionKeysForUser(userId)
}

export async function requirePermissionForApi(
  permission: PlatformPermissionKey
): Promise<{ ok: true; context: AdminAccessContext } | { ok: false; response: NextResponse }> {
  const access = await getAdminAccessForApi()
  if (!access.ok) {
    return access
  }
  const allowed = await hasPermission(access.context.actorId, access.context.actorEmail, permission)
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Forbidden: missing permission" }, { status: 403 }),
    }
  }
  return access
}

/** Super-admin style access: legacy admin bypass, or explicit platform_admin role assignment. */
export async function requireAdminRoleForApi(): Promise<
  { ok: true; context: AdminAccessContext } | { ok: false; response: NextResponse }
> {
  const access = await getAdminAccessForApi()
  if (!access.ok) {
    return access
  }
  const legacy = await hasLegacyAdminAccess(access.context.actorId, access.context.actorEmail)
  if (legacy) {
    return access
  }
  const isPlatformAdminRole = await hasRole(access.context.actorId, "platform_admin")
  if (!isPlatformAdminRole) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Forbidden: admin role required" }, { status: 403 }),
    }
  }
  return access
}

/** Roles & Permissions UI and APIs: legacy admin, or manage_roles_permissions. */
export async function requireManageRolesForApi(): Promise<
  { ok: true; context: AdminAccessContext } | { ok: false; response: NextResponse }
> {
  return requirePermissionForApi("manage_roles_permissions")
}

/** At least one of the permissions (legacy admin bypass still applies via hasPermission). */
export async function requireAnyPermissionForApi(
  permissions: PlatformPermissionKey[]
): Promise<{ ok: true; context: AdminAccessContext } | { ok: false; response: NextResponse }> {
  const access = await getAdminAccessForApi()
  if (!access.ok) {
    return access
  }
  for (const p of permissions) {
    if (await hasPermission(access.context.actorId, access.context.actorEmail, p)) {
      return access
    }
  }
  return {
    ok: false,
    response: NextResponse.json({ ok: false, error: "Forbidden: missing permission" }, { status: 403 }),
  }
}

/** Alias for route handlers: enforce a single platform permission (async). */
export const requirePermission = requirePermissionForApi

/** Alias: legacy admin or `platform_admin` platform role. */
export const requireAdminRole = requireAdminRoleForApi
