import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"

export default async function AdminBillingPage() {
  const [activeSubscriptions, pastDueSubscriptions, autoRechargeTeams, recentSubscriptions, teams] = await Promise.all([
    safeAdminDbQuery(() => prisma.subscription.count({ where: { status: "active" } }), 0),
    safeAdminDbQuery(() => prisma.subscription.count({ where: { status: "past_due" } }), 0),
    safeAdminDbQuery(() => prisma.subscription.count({ where: { autoRechargeEnabled: true } }), 0),
    safeAdminDbQuery(
      () =>
        prisma.subscription.findMany({
          include: { team: { select: { id: true, name: true, subscriptionStatus: true } } },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
      []
    ),
    safeAdminDbQuery(
      () =>
        prisma.team.findMany({
          select: {
            id: true,
            name: true,
            subscriptionStatus: true,
            teamStatus: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
      []
    ),
  ])

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Billing Control</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/70">Active subscriptions</p>
          <p className="text-2xl font-semibold">{activeSubscriptions}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/70">Past due subscriptions</p>
          <p className="text-2xl font-semibold">{pastDueSubscriptions}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/70">Auto-recharge teams</p>
          <p className="text-2xl font-semibold">{autoRechargeTeams}</p>
        </div>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-semibold">Subscription Overrides</h3>
        <p className="mt-1 text-xs text-white/70">
          Open a team detail page to override subscription status, extend grace period, suspend, or restore.
        </p>
        <div className="mt-3 space-y-2">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <span>
                {team.name} - {team.subscriptionStatus} / {team.teamStatus}
              </span>
              <Link href={`/admin/teams/${team.id}`} className="text-cyan-300 hover:text-cyan-200">
                Manage
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-semibold">Recent Subscription Records</h3>
        <div className="mt-3 space-y-2">
          {recentSubscriptions.length === 0 ? (
            <p className="text-sm text-white/70">No subscription records yet.</p>
          ) : (
            recentSubscriptions.map((subscription) => (
              <div key={subscription.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
                {subscription.team.name} | {subscription.status} | tier auto-recharge:{" "}
                {subscription.autoRechargeEnabled ? "on" : "off"}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
