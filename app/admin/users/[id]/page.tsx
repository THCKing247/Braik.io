import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminUserDetailActions } from "@/components/admin-user-detail-actions"
import { prisma } from "@/lib/prisma"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const user = await safeAdminDbQuery(
    () =>
      prisma.user.findUnique({
        where: { id: params.id },
        include: {
          memberships: {
            include: {
              team: {
                select: { id: true, name: true, teamStatus: true, subscriptionStatus: true },
              },
            },
          },
        },
      }),
    null
  )

  if (!user) {
    notFound()
  }

  const [adminAuditLogs, teamAudit] = await Promise.all([
    safeAdminDbQuery(
      () =>
        prisma.adminAuditLog.findMany({
          where: { actorId: user.id },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
      [] as Array<{ id: string; action: string; createdAt: Date }>
    ),
    safeAdminDbQuery(
      () =>
        prisma.auditLog.findMany({
          where: { actorUserId: user.id },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
      [] as Array<{ id: string; action: string; createdAt: Date }>
    ),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">User Detail</h2>
        <Link href="/admin/users" className="text-sm text-cyan-300 hover:text-cyan-200">
          Back to Users
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/70">{user.email}</p>
        <p className="text-sm text-white/70">
          Created {user.createdAt.toISOString().slice(0, 10)} | Last login{" "}
          {user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 10) : "Never"}
        </p>
        <p className="text-sm text-white/70">AI credits remaining: {user.aiCreditsRemaining}</p>
      </div>

      <AdminUserDetailActions
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          aiTier: user.aiTier,
          aiCreditsRemaining: user.aiCreditsRemaining,
          aiAutoRechargeEnabled: user.aiAutoRechargeEnabled,
        }}
      />

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-semibold">Team Memberships</h3>
        <div className="mt-3 space-y-2">
          {user.memberships.length === 0 ? (
            <p className="text-sm text-white/70">No team memberships.</p>
          ) : (
            user.memberships.map((membership) => (
              <div key={membership.id} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
                <p>
                  {membership.team.name} ({membership.role})
                </p>
                <p className="text-xs text-white/70">
                  Team status: {membership.team.teamStatus} | Subscription: {membership.team.subscriptionStatus}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-semibold">Admin Audit Log</h3>
          <div className="mt-3 space-y-2">
            {adminAuditLogs.length === 0 ? (
              <p className="text-sm text-white/70">No admin audit entries.</p>
            ) : (
              adminAuditLogs.map((log) => (
                <div key={log.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
                  {log.action} - {log.createdAt.toISOString()}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-semibold">User Activity Log</h3>
          <div className="mt-3 space-y-2">
            {teamAudit.length === 0 ? (
              <p className="text-sm text-white/70">No user activity entries.</p>
            ) : (
              teamAudit.map((log) => (
                <div key={log.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
                  {log.action} - {log.createdAt.toISOString()}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
