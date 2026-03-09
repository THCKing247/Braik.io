import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { ROLES, type Role, canManageTeam, canEditRoster, canManageBilling, canPostAnnouncements, canViewPayments } from "./roles"
import { logPermissionDenial } from "@/lib/audit/structured-logger"

export interface UserMembership {
  userId: string
  teamId: string
  role: Role
  permissions?: unknown
  positionGroups?: unknown
}

/** Map profile.role (e.g. head_coach) to team_members.role (e.g. HEAD_COACH). */
function profileRoleToTeamMemberRole(profileRole: string | null | undefined): Role {
  const raw = (profileRole ?? "player").toString().trim().toLowerCase().replace(/-/g, "_")
  if (raw === "head_coach") return ROLES.HEAD_COACH
  if (raw === "assistant_coach") return ROLES.ASSISTANT_COACH
  if (raw === "parent") return ROLES.PARENT
  if (raw === "school_admin" || raw === "admin") return ROLES.SCHOOL_ADMIN
  return ROLES.PLAYER
}

export async function getUserMembership(teamId: string): Promise<UserMembership | null> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return null
  }

  const supabase = getSupabaseServer()
  type TeamMemberRow = { team_id: string; user_id: string; role: string; permissions?: unknown }
  let membership: TeamMemberRow | null = await supabase
    .from("team_members")
    .select("team_id, user_id, role, permissions")
    .eq("user_id", session.user.id)
    .eq("team_id", teamId)
    .eq("active", true)
    .maybeSingle()
    .then((r) => r.data as TeamMemberRow | null)

  // Recovery: no active membership. Try (1) reactivate inactive row, (2) insert missing row, (3) handle unique conflict.
  if (!membership) {
    const { data: inactiveData } = await supabase
      .from("team_members")
      .select("team_id, user_id, role, permissions")
      .eq("user_id", session.user.id)
      .eq("team_id", teamId)
      .eq("active", false)
      .maybeSingle()
    const inactiveRow = inactiveData as TeamMemberRow | null

    if (inactiveRow) {
      await supabase.from("team_members").update({ active: true }).eq("user_id", session.user.id).eq("team_id", teamId)
      membership = inactiveRow
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id, role")
        .eq("id", session.user.id)
        .maybeSingle()

      const profileMatches = profile?.team_id === teamId
      const sessionMatches = session.user.teamId === teamId
      let isTeamCreator = false
      if (!profileMatches && !sessionMatches) {
        const { data: team } = await supabase.from("teams").select("created_by").eq("id", teamId).maybeSingle()
        isTeamCreator = (team as { created_by?: string } | null)?.created_by === session.user.id
      }

      if (profileMatches || sessionMatches || isTeamCreator) {
        // Ensure user exists in public.users so team_members insert (FK) succeeds
        try {
          await supabase
            .from("users")
            .upsert(
              {
                id: session.user.id,
                email: session.user.email ?? "",
                name: session.user.name ?? null,
                role: profileRoleToUserRole(profile?.role),
                status: "active",
              },
              { onConflict: "id" }
            )
            .select()
        } catch {
          // ignore — best-effort so team_members insert can succeed
        }

        const role = profile ? profileRoleToTeamMemberRole(profile.role) : ROLES.HEAD_COACH
        const { error } = await supabase.from("team_members").insert({
          team_id: teamId,
          user_id: session.user.id,
          role,
          active: true,
        })
        if (!error) {
          membership = { team_id: teamId, user_id: session.user.id, role, permissions: undefined as unknown }
        } else if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("team_members")
            .update({ active: true })
            .eq("user_id", session.user.id)
            .eq("team_id", teamId)
            .select("team_id, user_id, role, permissions")
            .single()
          if (existing) membership = existing as TeamMemberRow
        }
      }
    }
  }

  if (!membership) {
    return null
  }

  // Normalize role to uppercase with underscores so permission checks (e.g. canEditRoster)
  // match ROLES.HEAD_COACH / ROLES.ASSISTANT_COACH regardless of DB storage (head_coach vs HEAD_COACH).
  const rawRole = (membership.role ?? "PARENT") as string
  const role = rawRole.toUpperCase().replace(/[\s-]/g, "_") as Role

  return {
    userId: membership.user_id,
    teamId: membership.team_id,
    role,
    permissions: (membership as { permissions?: unknown }).permissions,
    positionGroups: (membership as { position_groups?: unknown }).position_groups,
  }
}

export async function requireAuth() {
  const session = await getServerSession()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user
}

export async function requireTeamAccess(teamId: string, requiredRole?: Role) {
  const user = await requireAuth()
  const membership = await getUserMembership(teamId)

  if (!membership) {
    logPermissionDenial({
      userId: user.id,
      teamId,
      reason: "Not a member of this team",
    })
    throw new Error("Access denied: Not a member of this team")
  }

  if (requiredRole && membership.role !== requiredRole) {
    logPermissionDenial({
      userId: user.id,
      teamId,
      role: membership.role,
      requiredRole,
      reason: `Requires ${requiredRole} role, but user has ${membership.role}`,
    })
    throw new Error(`Access denied: Requires ${requiredRole} role`)
  }

  return { user, membership }
}

export async function requireTeamPermission(
  teamId: string,
  permission: "manage" | "edit_roster" | "manage_billing" | "post_announcements" | "view_payments"
) {
  const { membership } = await requireTeamAccess(teamId)

  const checks = {
    manage: canManageTeam,
    edit_roster: canEditRoster,
    manage_billing: canManageBilling,
    post_announcements: canPostAnnouncements,
    view_payments: canViewPayments,
  }

  if (!checks[permission](membership.role)) {
    logPermissionDenial({
      userId: membership.userId,
      teamId,
      role: membership.role,
      requiredPermission: permission,
      reason: `Insufficient permissions for ${permission}`,
    })
    throw new Error(`Access denied: Insufficient permissions for ${permission}`)
  }

  return { membership }
}
