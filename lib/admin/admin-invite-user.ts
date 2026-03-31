import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { UserRole } from "@/lib/auth/user-roles"
import { setPrimaryHeadCoach, upsertStaffTeamMember } from "@/lib/team-members-sync"

export type AdminInviteVideoFlags = {
  can_view_video: boolean
  can_upload_video: boolean
  can_create_clips: boolean
  can_share_clips: boolean
  can_delete_video: boolean
}

function profileRoleFromUserRole(role: UserRole): string {
  switch (role) {
    case "athlete":
      return "player"
    case "assistant_coach":
      return "assistant_coach"
    case "head_coach":
      return "head_coach"
    case "parent":
      return "parent"
    case "athletic_director":
      return "athletic_director"
    case "admin":
      return "assistant_coach"
    default:
      return "player"
  }
}

/**
 * Sends Supabase invite email (password set via secure link). No plaintext passwords.
 */
export async function adminInviteUser(args: {
  email: string
  fullName: string
  userRole: UserRole
  teamId: string | null
  organizationId: string | null
  accountStatus: string
  video: AdminInviteVideoFlags
  invitedByUserId: string | null
  appOrigin: string
}): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const supabase = getSupabaseServer()
  const email = args.email.trim().toLowerCase()
  const profileRole = profileRoleFromUserRole(args.userRole)
  const redirectTo = `${args.appOrigin.replace(/\/$/, "")}/login`

  const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: args.fullName, role: profileRole },
    redirectTo,
  })

  if (inviteErr || !inviteData?.user) {
    const msg = (inviteErr?.message ?? "invite failed").toLowerCase()
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { ok: false, status: 409, error: "An account with this email already exists." }
    }
    return { ok: false, status: 400, error: inviteErr?.message ?? "Failed to send invite" }
  }

  const userId = inviteData.user.id

  const { error: usersErr } = await supabase.from("users").upsert(
    {
      id: userId,
      email,
      name: args.fullName,
      role: args.userRole,
      status: args.accountStatus,
    },
    { onConflict: "id" }
  )
  if (usersErr) {
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    return { ok: false, status: 500, error: usersErr.message }
  }

  const { error: profErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: args.fullName,
      role: profileRole,
      team_id: args.teamId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  )
  if (profErr) {
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    await supabase.from("users").delete().eq("id", userId)
    return { ok: false, status: 500, error: profErr.message }
  }

  if (args.teamId) {
    if (args.userRole === "head_coach") {
      const hc = await setPrimaryHeadCoach(supabase, args.teamId, userId, { source: "admin_invite" })
      if (hc.error) {
        await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
        await supabase.from("users").delete().eq("id", userId)
        await supabase.from("profiles").delete().eq("id", userId)
        return { ok: false, status: 400, error: hc.error.message }
      }
    } else if (args.userRole === "assistant_coach") {
      const ac = await upsertStaffTeamMember(supabase, args.teamId, userId, "assistant_coach", {
        source: "admin_invite",
      })
      if (ac.error) {
        await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
        await supabase.from("users").delete().eq("id", userId)
        await supabase.from("profiles").delete().eq("id", userId)
        return { ok: false, status: 400, error: ac.error.message }
      }
    } else if (args.userRole === "athlete") {
      const pl = await upsertStaffTeamMember(supabase, args.teamId, userId, "player", { source: "admin_invite" })
      if (pl.error) {
        await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
        await supabase.from("users").delete().eq("id", userId)
        await supabase.from("profiles").delete().eq("id", userId)
        return { ok: false, status: 400, error: pl.error.message }
      }
    } else if (args.userRole === "parent") {
      const pr = await upsertStaffTeamMember(supabase, args.teamId, userId, "parent", { source: "admin_invite" })
      if (pr.error) {
        await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
        await supabase.from("users").delete().eq("id", userId)
        await supabase.from("profiles").delete().eq("id", userId)
        return { ok: false, status: 400, error: pr.error.message }
      }
    }
  }

  const { error: vidErr } = await supabase.from("user_video_permissions").upsert(
    {
      user_id: userId,
      can_view_video: args.video.can_view_video,
      can_upload_video: args.video.can_upload_video,
      can_create_clips: args.video.can_create_clips,
      can_share_clips: args.video.can_share_clips,
      can_delete_video: args.video.can_delete_video,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  if (vidErr) {
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    await supabase.from("users").delete().eq("id", userId)
    await supabase.from("profiles").delete().eq("id", userId)
    return { ok: false, status: 500, error: vidErr.message }
  }

  const { error: piErr } = await supabase.from("platform_user_invites").insert({
    email,
    invited_role: args.userRole,
    team_id: args.teamId,
    organization_id: args.organizationId,
    account_status: args.accountStatus,
    auth_user_id: userId,
    invited_by_user_id: args.invitedByUserId,
    invite_status: "sent",
  })
  if (piErr) {
    console.error("[admin-invite-user] platform_user_invites insert:", piErr.message)
  }

  return { ok: true, userId }
}
