import type { SupabaseClient } from "@supabase/supabase-js"
import { isSupabaseSchemaObjectMissingError } from "@/lib/admin/supabase-schema-error"

/** Distinct users assigned to this platform role (primary column + junction), excluding one user id if provided. */
export async function countUsersWithPlatformRoleExcept(
  supabase: SupabaseClient,
  roleId: string,
  excludeUserId?: string
): Promise<number> {
  const ids = new Set<string>()

  let uq = supabase.from("users").select("id").eq("platform_role_id", roleId)
  if (excludeUserId) uq = uq.neq("id", excludeUserId)
  const { data: urows, error: uErr } = await uq
  if (uErr && !isSupabaseSchemaObjectMissingError(uErr)) {
    console.warn("[count-platform-role] users:", uErr.message)
  } else {
    for (const r of urows ?? []) ids.add((r as { id: string }).id)
  }

  let jq = supabase.from("user_platform_roles").select("user_id").eq("role_id", roleId)
  if (excludeUserId) jq = jq.neq("user_id", excludeUserId)
  const { data: jrows, error: jErr } = await jq
  if (jErr && !isSupabaseSchemaObjectMissingError(jErr)) {
    console.warn("[count-platform-role] user_platform_roles:", jErr.message)
  } else {
    for (const r of jrows ?? []) ids.add((r as { user_id: string }).user_id)
  }

  return ids.size
}
