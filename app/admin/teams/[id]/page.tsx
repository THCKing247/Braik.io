import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminTeamDetailActions } from "@/components/admin-team-detail-actions"
import { prisma } from "@/lib/prisma"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"

export default async function AdminTeamDetailPage({ params }: { params: { id: string } }) {
  const team = await safeAdminDbQuery(
    () =>
      prisma.team.findUnique({
        where: { id: params.id },
        include: {
          organization: true,
          memberships: {
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          },
        },
      }),
    null
  )

  if (!team) {
    notFound()
  }

  const [subscriptions, agentActions, audit] = await Promise.all([
    safeAdminDbQuery(
      () =>
        prisma.subscription.findMany({
          where: { teamId: team.id },
          orderBy: { createdAt: "desc" },
        }),
      [] as Array<{ id: string; status: string; currentPeriodEnd: Date | null }>
    ),
    safeAdminDbQuery(
      () =>
        prisma.agentAction.findMany({
          where: { teamId: team.id },
          orderBy: { executedAt: "desc" },
          take: 50,
        }),
      [] as Array<{ id: string; actionType: string; costInCredits: number; executedAt: Date }>
    ),
    safeAdminDbQuery(
      () =>
        prisma.adminAuditLog.findMany({
          where: { targetType: "team", targetId: team.id },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
      [] as Array<{ id: string; action: string; createdAt: Date }>
    ),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Team Detail</h2>
        <Link href="/admin/teams" className="text-sm text-cyan-300 hover:text-cyan-200">
          Back to Teams
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/70">
          {team.name} ({team.organization.name})
        </p>
        <p className="text-sm text-white/70">
          Subscription: {team.subscriptionStatus} | Team status: {team.teamStatus}
        </p>
      </div>

      <AdminTeamDetailActions
        team={{
          id: team.id,
          name: team.name,
          subscriptionStatus: team.subscriptionStatus,
          teamStatus: team.teamStatus,
          baseAiCredits: team.baseAiCredits,
          aiUsageThisCycle: team.aiUsageThisCycle,
          aiEnabled: team.aiEnabled,
          aiDisabledByPlatform: team.aiDisabledByPlatform,
        }}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-semibold">Subscription Records</h3>
          <div className="mt-3 space-y-2">
            {subscriptions.length === 0 ? (
              <p className="text-sm text-white/70">No subscription records.</p>
            ) : (
              subscriptions.map((sub) => (
                <div key={sub.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
                  {sub.status} | period end {sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString().slice(0, 10) : "n/a"}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-semibold">AI Usage Breakdown</h3>
          <div className="mt-3 space-y-2">
            {agentActions.length === 0 ? (
              <p className="text-sm text-white/70">No AI action records.</p>
            ) : (
              agentActions.map((action) => (
                <div key={action.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
                  {action.actionType} | {Math.round(action.costInCredits)} credits | {action.executedAt.toISOString()}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-semibold">Team Audit Log</h3>
        <div className="mt-3 space-y-2">
          {audit.length === 0 ? (
            <p className="text-sm text-white/70">No admin team audit records.</p>
          ) : (
            audit.map((log) => (
              <div key={log.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
                {log.action} | {log.createdAt.toISOString()}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-semibold">Coaches & Members</h3>
        <div className="mt-3 space-y-2">
          {team.memberships.map((membership) => (
            <div key={membership.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
              {membership.user.name || membership.user.email} ({membership.role})
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
