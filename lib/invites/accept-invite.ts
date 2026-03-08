import type { SupabaseClient } from "@supabase/supabase-js"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import type { InviteRecord } from "./validate-invite"

export type AcceptInviteResult =
  | { success: true }
  | { success: false; reason: "email_mismatch" | "head_coach_exists" | "db_error"; message: string }

const HEAD_COACH_ROLE = "HEAD_COACH"
const PROFILE_HEAD_COACH = "head_coach"

/**
 * Accept an invite: create team_members, update profile and users, set accepted_at/accepted_by.
 * Caller must have validated the invite and ensured the session user's email matches invite.email.
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
    const { data: existing } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", invite.team_id)
      .eq("role", HEAD_COACH_ROLE)
      .eq("active", true)
      .maybeSingle()

    if (existing && existing.user_id !== acceptingUserId) {
      return {
        success: false,
        reason: "head_coach_exists",
        message: "This team already has a head coach assigned.",
      }
    }
    if (existing && existing.user_id === acceptingUserId) {
      // Same user already a member - just mark invite accepted
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

  const { error: memberErr } = await supabase.from("team_members").insert({
    team_id: invite.team_id,
    user_id: acceptingUserId,
    role: isHeadCoach ? HEAD_COACH_ROLE : "PLAYER",
    active: true,
  })

  if (memberErr) {
    if (memberErr.code === "23505") {
      // Unique violation - already a member, just mark accepted
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
    return { success: false, reason: "db_error", message: memberErr.message }
  }

  const profileRole = isHeadCoach ? PROFILE_HEAD_COACH : "player"
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: acceptingUserId,
      email: acceptingUserEmail,
      full_name: acceptingUserName,
      role: profileRole,
      team_id: invite.team_id,
      updated_at: new Date().toISOString(),
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
