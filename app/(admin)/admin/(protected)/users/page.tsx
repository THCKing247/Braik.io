import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
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
      let q = supabase.from("users").select("id, email, name, role, status, created_at, last_login_at").order("created_at", { ascending: false }).limit(100)
      if (query) {
        q = q.or(`email.ilike.%${query}%,name.ilike.%${query}%`)
      }
      const { data: rows } = await q
      const withMemberships = await Promise.all(
        (rows ?? []).map(async (u) => {
          const { data: memberships } = await supabase.from("team_members").select("role, team_id").eq("user_id", u.id)
          const teamIds = [...new Set((memberships ?? []).map((m) => m.team_id))]
          const { data: teams } = teamIds.length > 0 ? await supabase.from("teams").select("id, name").in("id", teamIds) : { data: [] }
          return {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            status: u.status,
            createdAt: u.created_at,
            lastLoginAt: u.last_login_at,
            memberships: (memberships ?? []).map((m) => ({
              role: m.role,
              team: (teams ?? []).find((t) => t.id === m.team_id) ?? { id: m.team_id, name: "" },
            })),
          }
        })
      )
      return withMemberships
    },
    [] as Array<{
      id: string
      email: string
      name: string | null
      role: string
      status: string
      createdAt: string
      lastLoginAt: string | null
      memberships: Array<{ role: string; team: { id: string; name: string } }>
    }>
  )

  return (
    <OperatorUsers
      users={users.map((user) => ({
        ...user,
        createdAt: new Date(user.createdAt).toISOString(),
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
      }))}
    />
  )
}
