import type { PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"
import { getEffectivePermissionKeysForUser } from "@/lib/permissions/platform-permissions"

export function permissionSetHasKey(
  permissions: Set<PlatformPermissionKey>,
  key: PlatformPermissionKey
): boolean {
  return permissions.has(key)
}

export function hasAnyPermissionKey(
  permissions: Set<PlatformPermissionKey>,
  keys: PlatformPermissionKey[]
): boolean {
  return keys.some((k) => permissions.has(k))
}

export function hasAllPermissionKeys(
  permissions: Set<PlatformPermissionKey>,
  keys: PlatformPermissionKey[]
): boolean {
  return keys.every((k) => permissions.has(k))
}

/** Server-side: full effective permission set (platform roles; legacy admins get all keys in getEffectivePermissionKeysForUser). */
export async function getUserPermissionKeys(userId: string): Promise<Set<PlatformPermissionKey>> {
  return getEffectivePermissionKeysForUser(userId)
}
