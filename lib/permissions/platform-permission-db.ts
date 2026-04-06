import { isSupabaseSchemaObjectMissingError } from "@/lib/admin/supabase-schema-error"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { isPlatformPermissionKey, type PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"

/**
 * Platform role UUIDs for this user: prefers `user_platform_roles` rows when present,
 * otherwise `users.platform_role_id` (migration-safe if junction table missing).
 */
export async function getPlatformRoleIdsForUser(supabase: ReturnType<typeof getSupabaseServer>, userId: string): Promise<string[]> {
  const { data: junction, error: jErr } = await supabase.from("user_platform_roles").select("role_id").eq("user_id", userId)

  if (!jErr && junction && junction.length > 0) {
    return junction.map((r) => (r as { role_id: string }).role_id)
  }
  if (jErr && !isSupabaseSchemaObjectMissingError(jErr)) {
    console.warn("[platform-permission-db] user_platform_roles:", jErr.message)
  }

  const { data: user, error: uErr } = await supabase.from("users").select("platform_role_id").eq("id", userId).maybeSingle()
  if (uErr && !isSupabaseSchemaObjectMissingError(uErr)) {
    console.warn("[platform-permission-db] users.platform_role_id:", uErr.message)
  }
  const roleId = user?.platform_role_id as string | null | undefined
  return roleId ? [roleId] : []
}

/** Direct DB check: does this user's platform role(s) include the permission? (Ignores legacy admin.) */
export async function userHasPlatformPermission(userId: string, permission: PlatformPermissionKey): Promise<boolean> {
  const supabase = getSupabaseServer()
  const roleIds = await getPlatformRoleIdsForUser(supabase, userId)
  if (roleIds.length === 0) return false

  const { data, error } = await supabase
    .from("platform_role_permissions")
    .select("permission_key")
    .in("role_id", roleIds)
    .eq("permission_key", permission)
    .limit(1)

  if (error) {
    if (isSupabaseSchemaObjectMissingError(error)) return false
    console.warn("[platform-permission-db] platform_role_permissions:", error.message)
    return false
  }
  return Boolean(data && data.length > 0)
}

export async function fetchPlatformPermissionKeysForUser(userId: string): Promise<Set<PlatformPermissionKey>> {
  const supabase = getSupabaseServer()
  const roleIds = await getPlatformRoleIdsForUser(supabase, userId)
  if (roleIds.length === 0) return new Set()

  const { data: rows, error } = await supabase
    .from("platform_role_permissions")
    .select("permission_key")
    .in("role_id", roleIds)

  if (error) {
    if (isSupabaseSchemaObjectMissingError(error)) return new Set()
    console.warn("[platform-permission-db] fetch permissions:", error.message)
    return new Set()
  }

  const out = new Set<PlatformPermissionKey>()
  for (const r of rows ?? []) {
    const k = (r as { permission_key?: string }).permission_key
    if (k && isPlatformPermissionKey(k)) out.add(k)
  }
  return out
}
