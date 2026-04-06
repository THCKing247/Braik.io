import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getFallbackPlatformPermissionGroups,
  getFallbackPlatformRoles,
  type FallbackPermissionGroup,
  type PlatformRoleListItem,
} from "@/lib/admin/fallback-platform-roles"
import { isSupabaseSchemaObjectMissingError } from "@/lib/admin/supabase-schema-error"
import { isPlatformPermissionKey, type PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"

export type { PlatformRoleListItem }

export type LoadPlatformRolesListResult =
  | {
      ok: true
      source: "database" | "fallback"
      roles: PlatformRoleListItem[]
      catalogReadOnly: boolean
      permissionGroups?: FallbackPermissionGroup[]
    }
  | { ok: false; error: string; logDetail?: string }

type DbRoleRow = {
  id: string
  key: string
  name: string
  description?: string | null
  role_type?: string
  is_active?: boolean
  is_deletable?: boolean
  is_key_editable?: boolean
}

export async function loadPlatformRolesList(supabase: SupabaseClient): Promise<LoadPlatformRolesListResult> {
  const { data: roleRows, error: rolesErr } = await supabase
    .from("platform_roles")
    .select("*")
    .order("name", { ascending: true })

  if (rolesErr) {
    if (isSupabaseSchemaObjectMissingError(rolesErr)) {
      console.warn("[platform-roles] platform_roles unavailable; using in-code catalog:", rolesErr.message)
      return {
        ok: true,
        source: "fallback",
        catalogReadOnly: true,
        roles: getFallbackPlatformRoles(),
        permissionGroups: getFallbackPlatformPermissionGroups(),
      }
    }
    return {
      ok: false,
      error: "Failed to load platform roles",
      logDetail: `platform_roles: ${rolesErr.code ?? ""} ${rolesErr.message}`,
    }
  }

  const roles = (roleRows ?? []) as DbRoleRow[]
  const counts = await loadUserCountsByRoleId(supabase)
  const permMap = await loadPermissionKeysByRoleId(supabase)

  const mapped: PlatformRoleListItem[] = roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description ?? null,
    role_type: r.role_type ?? "custom",
    is_active: r.is_active ?? true,
    is_deletable: r.is_deletable ?? true,
    is_key_editable: r.is_key_editable ?? true,
    userCount: counts.get(r.id) ?? 0,
    permissionKeys: permMap.get(r.id) ?? [],
  }))

  return {
    ok: true,
    source: "database",
    catalogReadOnly: false,
    roles: mapped,
  }
}

async function loadUserCountsByRoleId(supabase: SupabaseClient): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const { data: userRows, error: usersErr } = await supabase.from("users").select("platform_role_id").not("platform_role_id", "is", null)

  if (usersErr) {
    if (isSupabaseSchemaObjectMissingError(usersErr)) {
      console.warn("[platform-roles] users.platform_role_id not available; user counts default to 0:", usersErr.message)
      return counts
    }
    console.warn("[platform-roles] user count query failed; user counts default to 0:", usersErr.message)
    return counts
  }

  for (const u of userRows ?? []) {
    const id = (u as { platform_role_id?: string }).platform_role_id
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

async function loadPermissionKeysByRoleId(supabase: SupabaseClient): Promise<Map<string, PlatformPermissionKey[]>> {
  const map = new Map<string, PlatformPermissionKey[]>()
  const { data: permRows, error: permErr } = await supabase.from("platform_role_permissions").select("role_id, permission_key")

  if (permErr) {
    if (isSupabaseSchemaObjectMissingError(permErr)) {
      console.warn("[platform-roles] platform_role_permissions unavailable; permission keys omitted:", permErr.message)
      return map
    }
    console.warn("[platform-roles] permission join failed; permission keys omitted:", permErr.message)
    return map
  }

  for (const row of permRows ?? []) {
    const roleId = (row as { role_id?: string; permission_key?: string }).role_id
    const key = (row as { permission_key?: string }).permission_key
    if (!roleId || !key || !isPlatformPermissionKey(key)) continue
    const list = map.get(roleId) ?? []
    list.push(key)
    map.set(roleId, list)
  }
  return map
}
