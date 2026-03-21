import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getMessagingPermissions,
  getUserType,
  validateThreadComposition,
  type UserRole,
  type UserType,
} from "@/lib/enforcement/messaging-permissions"

export function profileRoleToMessagingRole(profileRole: string | null | undefined): UserRole {
  const r = (profileRole ?? "").toLowerCase().replace(/-/g, "_")
  if (r === "head_coach") return "HEAD_COACH"
  if (r === "assistant_coach") return "ASSISTANT_COACH"
  if (r === "athletic_director" || r === "school_admin" || r === "admin") return "HEAD_COACH"
  if (r === "parent") return "PARENT"
  return "PLAYER"
}

export type ThreadCreateValidationResult =
  | { ok: true; creatorRole: UserRole; participantRoles: Array<{ role: UserRole; type: UserType }> }
  | { ok: false; status: number; error: string; code?: string }

/**
 * Server-side checks for new threads: team membership, who may create threads, and composition rules
 * (e.g. no parent+player without a coach). Complements RLS; must not rely on UI alone.
 */
export async function validateServerThreadCreation(
  supabase: SupabaseClient,
  teamId: string,
  creatorUserId: string,
  participantUserIds: string[]
): Promise<ThreadCreateValidationResult> {
  const allIds = [...new Set([creatorUserId, ...participantUserIds])]

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("team_id", teamId)
    .in("id", allIds)

  if (error) {
    console.error("[validateServerThreadCreation] profiles lookup failed", { teamId, error })
    return { ok: false, status: 500, error: "Failed to verify participants for this team." }
  }

  const byId = new Map((profiles ?? []).map((p: { id: string; role: string | null }) => [p.id, p]))

  for (const id of allIds) {
    if (!byId.has(id)) {
      return {
        ok: false,
        status: 400,
        code: "PARTICIPANT_NOT_ON_TEAM",
        error:
          "Every participant must belong to this team. Remove anyone who has not joined yet, or ask them to complete signup.",
      }
    }
  }

  const creatorRow = byId.get(creatorUserId)!
  const creatorRole = profileRoleToMessagingRole(creatorRow.role)
  const perms = getMessagingPermissions(creatorRole)

  if (!perms.canCreateThread()) {
    return {
      ok: false,
      status: 403,
      code: "THREAD_CREATE_DENIED",
      error:
        "Your role cannot start new message threads. Ask a coach to create the conversation, or reply in an existing thread.",
    }
  }

  const participantRoles = allIds.map((id) => {
    const role = profileRoleToMessagingRole(byId.get(id)!.role)
    return { role, type: getUserType(role) }
  })

  const composition = validateThreadComposition(creatorRole, participantRoles)
  if (!composition.valid) {
    return {
      ok: false,
      status: 403,
      code: "INVALID_THREAD_COMPOSITION",
      error: composition.reason ?? "This combination of participants is not allowed.",
    }
  }

  return { ok: true, creatorRole, participantRoles }
}
