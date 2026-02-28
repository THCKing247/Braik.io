import { prisma } from "@/lib/prisma"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"
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
  const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000)

  const [totalUsers, activeTeams, suspendedTeams, pastDueTeams, gracePeriodTeams, recentAuditEntries] = await Promise.all([
    safeAdminDbQuery(() => prisma.user.count(), 0),
    safeAdminDbQuery(() => prisma.team.count({ where: { teamStatus: "active" } }), 0),
    safeAdminDbQuery(() => prisma.team.count({ where: { teamStatus: "suspended" } }), 0),
    safeAdminDbQuery(() => prisma.team.count({ where: { subscriptionStatus: "past_due" } }), 0),
    safeAdminDbQuery(() => prisma.team.count({ where: { subscriptionStatus: "grace_period" } }), 0),
    safeAdminDbQuery(
      () =>
        prisma.adminAuditLog.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: 25,
          include: { actor: { select: { email: true } } },
        }),
      []
    ),
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
        recentAuditEntries: recentAuditEntries.map((entry: any) => ({
          id: entry.id,
          action: entry.action,
          createdAt: entry.createdAt.toISOString(),
          actorEmail: entry.actor?.email || "unknown",
        })),
      }}
    />
  )
}
