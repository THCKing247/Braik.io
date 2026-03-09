import type { SupabaseClient } from "@supabase/supabase-js"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import type { InviteRecord } from "./validate-invite"

export type AcceptInviteResult =
  | { success: true }
  | { success: false; reason: "email_mismatch" | "head_coach_exists" | "db_error"; message: string }

const PROFILE_HEAD_COACH = "head_coach"

/**
 * Accept an invite: update profile and users, set accepted_at/accepted_by.
 * Membership is stored in profiles (team_id, role); no team_members table in production.
 */
export async function acceptInvite(
  supabase: SupabaseClient,
  invite: InviteRecord,
  acceptingUserId: string,
  acceptingUserEmail: string,
  acceptingUserName: string | null
): Promise<AcceptInviteResult> {
  const normalizedInviteEmail = invite.email.trim().toLowerCase()
  const normalizedUserEmail = acceptingUserEmail.trim().toLowerCase()
  if (normalizedUserEmail !== normalizedInviteEmail) {
    return {
      success: false,
      reason: "email_mismatch",
      message: "Only the invited email address can accept this invitation.",
    }
  }

  const role = invite.role?.toLowerCase().replace(/-/g, "_")
  const isHeadCoach = role === "head_coach"

  if (isHeadCoach) {
    const { data: existingHeadCoach } = await supabase
      .from("profiles")
      .select("id")
      .eq("team_id", invite.team_id)
      .ilike("role", "head_coach")
      .maybeSingle()

    if (existingHeadCoach && existingHeadCoach.id !== acceptingUserId) {
      return {
        success: false,
        reason: "head_coach_exists",
        message: "This team already has a head coach assigned.",
      }
    }
    if (existingHeadCoach?.id === acceptingUserId) {
      const { error: updateErr } = await supabase
        .from("invites")
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by: acceptingUserId,
        })
        .eq("id", invite.id)
      if (updateErr) {
        return { success: false, reason: "db_error", message: updateErr.message }
      }
      return { success: true }
    }
  }

  const profileRole = isHeadCoach ? PROFILE_HEAD_COACH : "player"
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: acceptingUserId,
      email: acceptingUserEmail,
      full_name: acceptingUserName,
      role: profileRole,
      team_id: invite.team_id,
    },
    { onConflict: "id" }
  )

  if (profileErr) {
    return { success: false, reason: "db_error", message: profileErr.message }
  }

  const userRole = profileRoleToUserRole(profileRole)
  await supabase
    .from("users")
    .upsert(
      {
        id: acceptingUserId,
        email: acceptingUserEmail,
        name: acceptingUserName,
        role: userRole,
        status: "active",
      },
      { onConflict: "id" }
    )

  const { error: inviteUpdateErr } = await supabase
    .from("invites")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: acceptingUserId,
    })
    .eq("id", invite.id)

  if (inviteUpdateErr) {
    return { success: false, reason: "db_error", message: inviteUpdateErr.message }
  }

  return { success: true }
}
