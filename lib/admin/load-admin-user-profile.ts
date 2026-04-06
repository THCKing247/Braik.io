import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { isSupabaseSchemaObjectMissingError } from "@/lib/admin/supabase-schema-error"

export type AdminUserProfilePayload = {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  createdAt: string
  lastLoginAt: string | null
  platformRoleId: string | null
  platformRoleName: string | null
  platformRoleKey: string | null
  profileFullName: string | null
  profileRole: string | null
  profileSport: string | null
  profileProgramName: string | null
  team: { id: string; name: string } | null
  schoolName: string | null
  organizationName: string | null
  programName: string | null
}

export async function loadAdminUserProfile(userId: string): Promise<AdminUserProfilePayload | null> {
  return safeAdminDbQuery(async () => {
    const supabase = getSupabaseServer()

    let user: Record<string, unknown> | null = null
    const primary = await supabase
      .from("users")
      .select("id, email, name, role, status, created_at, last_login_at, platform_role_id")
      .eq("id", userId)
      .maybeSingle()

    if (primary.error) {
      if (isSupabaseSchemaObjectMissingError(primary.error) || primary.error.message?.includes("platform_role_id")) {
        const fb = await supabase
          .from("users")
          .select("id, email, name, role, status, created_at, last_login_at")
          .eq("id", userId)
          .maybeSingle()
        if (fb.error) throw fb.error
        user = fb.data as Record<string, unknown> | null
      } else {
        throw primary.error
      }
    } else {
      user = primary.data as Record<string, unknown> | null
    }

    if (!user) return null

    let platformRoleName: string | null = null
    let platformRoleKey: string | null = null
    const prid = user.platform_role_id as string | undefined
    if (prid) {
      const { data: pr } = await supabase.from("platform_roles").select("id, key, name").eq("id", prid).maybeSingle()
      if (pr) {
        platformRoleName = (pr as { name: string }).name
        platformRoleKey = (pr as { key: string }).key
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, team_id, school_id, sport, program_name")
      .eq("id", userId)
      .maybeSingle()

    let team: { id: string; name: string } | null = null
    let schoolName: string | null = null
    let organizationName: string | null = null
    let programName: string | null = null

    const teamId = profile?.team_id as string | undefined
    if (teamId) {
      const { data: t } = await supabase
        .from("teams")
        .select("id, name, org, program_id, school_id")
        .eq("id", teamId)
        .maybeSingle()
      if (t) {
        team = { id: t.id as string, name: t.name as string }
        const pid = t.program_id as string | undefined
        if (pid) {
          const { data: prog } = await supabase
            .from("programs")
            .select("program_name, organization_id")
            .eq("id", pid)
            .maybeSingle()
          if (prog) {
            programName = (prog.program_name as string) ?? null
            const oid = prog.organization_id as string | undefined
            if (oid) {
              const { data: o } = await supabase.from("organizations").select("name").eq("id", oid).maybeSingle()
              organizationName = (o?.name as string) ?? null
            }
          }
        }
        const sid = (t.school_id as string | undefined) ?? (profile?.school_id as string | undefined)
        if (sid) {
          const { data: s } = await supabase.from("schools").select("name").eq("id", sid).maybeSingle()
          schoolName = (s?.name as string) ?? null
        }
        if (!organizationName && (t.org as string)?.trim()) {
          organizationName = String(t.org).trim()
        }
      }
    } else if (profile?.school_id) {
      const { data: s } = await supabase.from("schools").select("name").eq("id", profile.school_id).maybeSingle()
      schoolName = (s?.name as string) ?? null
    }

    return {
      id: user.id as string,
      email: user.email as string,
      name: (user.name as string | null) ?? null,
      role: String(user.role ?? "user"),
      status: String(user.status ?? "active"),
      createdAt:
        typeof user.created_at === "string"
          ? user.created_at
          : new Date(user.created_at as string).toISOString(),
      lastLoginAt: user.last_login_at
        ? typeof user.last_login_at === "string"
          ? user.last_login_at
          : new Date(user.last_login_at as string).toISOString()
        : null,
      platformRoleId: prid ?? null,
      platformRoleName,
      platformRoleKey,
      profileFullName: (profile?.full_name as string | null) ?? null,
      profileRole: (profile?.role as string | null) ?? null,
      profileSport: (profile?.sport as string | null) ?? null,
      profileProgramName: (profile?.program_name as string | null) ?? null,
      team,
      schoolName,
      organizationName,
      programName,
    }
  }, null)
}
