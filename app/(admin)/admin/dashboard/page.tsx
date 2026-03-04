import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { OperatorDashboard } from "@/components/admin/operator-dashboard"

function getDaysFromFilter(value?: string): number {
  const parsed = Number(value)
  if (parsed === 7 || parsed === 30 || parsed === 90 || parsed === 365) {
    return parsed
  }
  return 30
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: { tf?: string }
}) {
  const timeframeDays = getDaysFromFilter(searchParams?.tf)
  const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000).toISOString()

  const supabase = getSupabaseServer()

  const [totalUsers, activeTeams, suspendedTeams, pastDueTeams, gracePeriodTeams, recentAuditEntries] = await Promise.all([
    safeAdminDbQuery(async () => {
      const { count } = await supabase.from("users").select("*", { count: "exact", head: true })
      return count ?? 0
    }, 0),
    safeAdminDbQuery(async () => {
      const { count } = await supabase.from("teams").select("*", { count: "exact", head: true }).eq("team_status", "active")
      return count ?? 0
    }, 0),
    safeAdminDbQuery(async () => {
      const { count } = await supabase.from("teams").select("*", { count: "exact", head: true }).eq("team_status", "suspended")
      return count ?? 0
    }, 0),
    safeAdminDbQuery(async () => {
      const { count } = await supabase.from("teams").select("*", { count: "exact", head: true }).eq("subscription_status", "past_due")
      return count ?? 0
    }, 0),
    safeAdminDbQuery(async () => {
      const { count } = await supabase.from("teams").select("*", { count: "exact", head: true }).eq("subscription_status", "grace_period")
      return count ?? 0
    }, 0),
    safeAdminDbQuery(async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, created_at, actor_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(25)
      const entries = data ?? []
      const actorIds = [...new Set(entries.map((e) => e.actor_id))]
      const { data: users } = actorIds.length > 0 ? await supabase.from("users").select("id, email").in("id", actorIds) : { data: [] }
      const userMap = new Map((users ?? []).map((u) => [u.id, u.email]))
      return entries.map((e) => ({
        id: e.id,
        action: e.action,
        createdAt: e.created_at,
        actor: { email: userMap.get(e.actor_id) ?? "unknown" },
      }))
    }, [] as Array<{ id: string; action: string; createdAt: string; actor: { email: string } }>),
  ])

  return (
    <OperatorDashboard
      timeframeDays={timeframeDays}
      metrics={{
        totalUsers,
        activeTeams,
        suspendedTeams,
        pastDueTeams,
        gracePeriodTeams,
        recentAuditEntries: recentAuditEntries.map((entry) => ({
          id: entry.id,
          action: entry.action,
          createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date(entry.createdAt).toISOString(),
          actorEmail: entry.actor?.email ?? "unknown",
        })),
      }}
    />
  )
}
