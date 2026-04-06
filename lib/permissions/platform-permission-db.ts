import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { isPlatformPermissionKey, type PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"

/** Direct DB check: does this user's assigned platform role include the permission? (Ignores legacy admin.) */
export async function userHasPlatformPermission(userId: string, permission: PlatformPermissionKey): Promise<boolean> {
  const supabase = getSupabaseServer()
  const { data: user } = await supabase
    .from("users")
    .select("platform_role_id")
    .eq("id", userId)
    .maybeSingle()

  const roleId = user?.platform_role_id as string | null | undefined
  if (!roleId) return false

  const { data: row } = await supabase
    .from("platform_role_permissions")
    .select("permission_key")
    .eq("role_id", roleId)
    .eq("permission_key", permission)
    .maybeSingle()

  return Boolean(row)
}

export async function fetchPlatformPermissionKeysForUser(userId: string): Promise<Set<PlatformPermissionKey>> {
  const supabase = getSupabaseServer()
  const { data: user } = await supabase
    .from("users")
    .select("platform_role_id")
    .eq("id", userId)
    .maybeSingle()

  const roleId = user?.platform_role_id as string | null | undefined
  if (!roleId) return new Set()

  const { data: rows } = await supabase
    .from("platform_role_permissions")
    .select("permission_key")
    .eq("role_id", roleId)

  const out = new Set<PlatformPermissionKey>()
  for (const r of rows ?? []) {
    const k = (r as { permission_key?: string }).permission_key
    if (k && isPlatformPermissionKey(k)) out.add(k)
  }
  return out
}
