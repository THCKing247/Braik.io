import { Suspense } from "react"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { effectiveAppRoleForAdmin, type UserRole } from "@/lib/auth/user-roles"
import { OperatorUsers } from "@/components/admin/operator-users"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string }
}) {
  const query = searchParams?.q?.trim() || ""
  const supabase = getSupabaseServer()

  const users = await safeAdminDbQuery(
    async () => {
      let q = supabase
        .from("users")
        .select("id, email, name, role, status, created_at, last_login_at, platform_role_id")
        .order("created_at", { ascending: false })
        .limit(100)
      if (query) {
        q = q.or(`email.ilike.%${query}%,name.ilike.%${query}%`)
      }
      const { data: rows } = await q
      const roleIds = [...new Set((rows ?? []).map((r) => r.platform_role_id).filter(Boolean))] as string[]
      const { data: proles } =
        roleIds.length > 0
          ? await supabase.from("platform_roles").select("id, key, name").in("id", roleIds)
          : { data: [] as { id: string; key: string; name: string }[] }
      const roleById = new Map((proles ?? []).map((r) => [r.id, r as { id: string; key: string; name: string }]))

      const withMemberships = await Promise.all(
        (rows ?? []).map(async (u) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, team_id")
            .eq("id", u.id)
            .maybeSingle()
          const teamIds = profile?.team_id ? [profile.team_id] : []
          const { data: teams } = teamIds.length > 0 ? await supabase.from("teams").select("id, name").in("id", teamIds) : { data: [] }
          const memberships = profile?.team_id
            ? [
                {
                  role: profile.role ?? "player",
                  team: (teams ?? []).find((t) => t.id === profile.team_id) ?? { id: profile.team_id, name: "" },
                },
              ]
            : []
          const pr = u.platform_role_id ? roleById.get(u.platform_role_id as string) : undefined
          const role = effectiveAppRoleForAdmin(u.role as string, profile?.role as string | null)
          return {
            id: u.id,
            email: u.email,
            name: u.name,
            role,
            status: u.status,
            createdAt: u.created_at,
            lastLoginAt: u.last_login_at,
            memberships,
            platformRoleId: (u.platform_role_id as string | null) ?? null,
            platformRoleName: pr?.name ?? null,
            platformRoleKey: pr?.key ?? null,
          }
        })
      )
      return withMemberships
    },
    [] as Array<{
      id: string
      email: string
      name: string | null
      role: UserRole
      status: string
      createdAt: string
      lastLoginAt: string | null
      memberships: Array<{ role: string; team: { id: string; name: string } }>
      platformRoleId: string | null
      platformRoleName: string | null
      platformRoleKey: string | null
    }>
  )

  return (
    <Suspense fallback={<p className="text-sm text-admin-muted">Loading accounts…</p>}>
      <OperatorUsers
        users={users.map((user) => ({
          ...user,
          createdAt: new Date(user.createdAt).toISOString(),
          lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
        }))}
      />
    </Suspense>
  )
}
