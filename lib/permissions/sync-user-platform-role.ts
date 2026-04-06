import type { SupabaseClient } from "@supabase/supabase-js"
import { isSupabaseSchemaObjectMissingError } from "@/lib/admin/supabase-schema-error"

/**
 * Keeps `user_platform_roles` in sync with `users.platform_role_id`.
 * Single primary platform role for now (one row in junction when set).
 */
export async function syncUserPlatformRoleMirror(
  supabase: SupabaseClient,
  userId: string,
  platformRoleId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const del = await supabase.from("user_platform_roles").delete().eq("user_id", userId)
  if (del.error && !isSupabaseSchemaObjectMissingError(del.error)) {
    return { ok: false, message: del.error.message }
  }
  if (del.error && isSupabaseSchemaObjectMissingError(del.error)) {
    return { ok: true }
  }

  if (!platformRoleId) {
    return { ok: true }
  }

  const ins = await supabase.from("user_platform_roles").insert({ user_id: userId, role_id: platformRoleId })
  if (ins.error) {
    if (isSupabaseSchemaObjectMissingError(ins.error)) {
      return { ok: true }
    }
    return { ok: false, message: ins.error.message }
  }
  return { ok: true }
}
