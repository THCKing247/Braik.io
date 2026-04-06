import type { SupabaseClient } from "@supabase/supabase-js"
import { isSupabaseSchemaObjectMissingError } from "@/lib/admin/supabase-schema-error"

export type PlatformRoleRef = { id: string; key: string }

/**
 * Map stored app roles (users.role / profiles.role) to platform_roles.key values.
 * athletic-director → athletic_director; admin / school_admin → platform_admin.
 */
export function normalizeStoredRoleToPlatformKey(role: string | null | undefined): string | null {
  if (!role || typeof role !== "string") return null
  const raw = role.trim().toLowerCase().replace(/-/g, "_")
  if (raw === "admin" || raw === "school_admin") return "platform_admin"
  if (
    raw === "athletic_director" ||
    raw === "head_coach" ||
    raw === "assistant_coach" ||
    raw === "team_staff" ||
    raw === "read_only"
  ) {
    return raw
  }
  return null
}

/** Prefer profiles.role (admin UI source), then users.role. */
function legacyPlatformKeyForUser(userRole: string | null | undefined, profileRole: string | null | undefined): string | null {
  return normalizeStoredRoleToPlatformKey(profileRole) ?? normalizeStoredRoleToPlatformKey(userRole)
}

/**
 * For each platform role, userCount =
 *   users with platform_role_id = role.id
 * + users with no platform_role_id whose legacy role maps to role.key
 *
 * Single fetch of users + profiles; in-memory aggregation (no N+1).
 */
export async function loadMergedPlatformRoleUserCounts(
  supabase: SupabaseClient,
  roles: PlatformRoleRef[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (const r of roles) {
    out.set(r.id, 0)
  }
  const userRows = await fetchAllUsersForRoleCount(supabase)
  if (!userRows) {
    return out
  }

  const profileMap = await fetchProfileRolesByUserId(supabase)
  if (!profileMap) {
    return out
  }

  const countsByUuid = new Map<string, number>()
  const countsByLegacyKey = new Map<string, number>()

  for (const row of userRows) {
    const id = row.id as string
    const platformRoleId = row.platform_role_id as string | null | undefined
    const userRole = row.role as string | null | undefined

    if (platformRoleId) {
      countsByUuid.set(platformRoleId, (countsByUuid.get(platformRoleId) ?? 0) + 1)
      continue
    }

    const profileRole = profileMap.get(id)
    const legacyKey = legacyPlatformKeyForUser(userRole, profileRole)
    if (!legacyKey) continue
    countsByLegacyKey.set(legacyKey, (countsByLegacyKey.get(legacyKey) ?? 0) + 1)
  }

  for (const r of roles) {
    const byUuid = countsByUuid.get(r.id) ?? 0
    const byLegacy = countsByLegacyKey.get(r.key) ?? 0
    out.set(r.id, byUuid + byLegacy)
  }

  return out
}

type UserRoleRow = { id: string; role?: string | null; platform_role_id?: string | null }

async function fetchAllUsersForRoleCount(supabase: SupabaseClient): Promise<UserRoleRow[] | null> {
  const primary = await supabase.from("users").select("id, role, platform_role_id")
  if (!primary.error) {
    return (primary.data ?? []) as UserRoleRow[]
  }

  const fallback = await supabase.from("users").select("id, role")
  if (!fallback.error) {
    console.warn("[platform-role-user-counts] using users without platform_role_id:", primary.error.message)
    return (fallback.data ?? []) as UserRoleRow[]
  }

  if (isSupabaseSchemaObjectMissingError(fallback.error)) {
    console.warn("[platform-role-user-counts] users table unavailable:", fallback.error.message)
    return null
  }
  console.warn("[platform-role-user-counts] users query failed:", fallback.error.message)
  return null
}

async function fetchProfileRolesByUserId(supabase: SupabaseClient): Promise<Map<string, string | null> | null> {
  const { data, error } = await supabase.from("profiles").select("id, role")
  if (error) {
    if (isSupabaseSchemaObjectMissingError(error)) {
      console.warn("[platform-role-user-counts] profiles unavailable; using users.role only:", error.message)
      return new Map()
    }
    console.warn("[platform-role-user-counts] profiles query failed; using users.role only:", error.message)
    return new Map()
  }
  const m = new Map<string, string | null>()
  for (const row of data ?? []) {
    const id = (row as { id?: string; role?: string | null }).id
    if (!id) continue
    m.set(id, (row as { role?: string | null }).role ?? null)
  }
  return m
}
