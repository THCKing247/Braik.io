import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"

export default async function AdminAIPage() {
  const [teams, userTiers, topActions, config] = await Promise.all([
    safeAdminDbQuery(
      () =>
        prisma.team.findMany({
          select: {
            id: true,
            name: true,
            baseAiCredits: true,
            aiUsageThisCycle: true,
            aiEnabled: true,
            aiDisabledByPlatform: true,
          },
          orderBy: { aiUsageThisCycle: "desc" },
          take: 100,
        }),
      []
    ),
    safeAdminDbQuery(
      () =>
        prisma.user.groupBy({
          by: ["aiTier"],
          _count: { aiTier: true },
        }),
      [] as Array<{ aiTier: string; _count: { aiTier: number } }>
    ),
    safeAdminDbQuery(
      () =>
        prisma.agentAction.groupBy({
          by: ["actionType"],
          _sum: { costInCredits: true },
          _count: { actionType: true },
          orderBy: { _sum: { costInCredits: "desc" } },
          take: 20,
        }),
      [] as Array<{ actionType: string; _sum: { costInCredits: number | null }; _count: { actionType: number } }>
    ),
    safeAdminDbQuery(
      () =>
        prisma.adminConfig.findMany({
          where: { key: { startsWith: "ai." } },
          orderBy: { key: "asc" },
        }),
      []
    ),
  ])

  const over80 = teams.filter((team) => team.baseAiCredits > 0 && team.aiUsageThisCycle / team.baseAiCredits >= 0.8)
  const at100 = teams.filter((team) => team.baseAiCredits > 0 && team.aiUsageThisCycle / team.baseAiCredits >= 1)

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">AI Control Center</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/70">Teams over 80% usage</p>
          <p className="text-2xl font-semibold">{over80.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/70">Teams at 100%</p>
          <p className="text-2xl font-semibold">{at100.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/70">AI tier distribution</p>
          <p className="text-sm font-semibold">
            {userTiers.map((item) => `${item.aiTier}:${item._count.aiTier}`).join(" | ") || "none"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/70">Cost config entries</p>
          <p className="text-2xl font-semibold">{config.length}</p>
        </div>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-semibold">High Usage Teams</h3>
        <div className="mt-3 space-y-2">
          {over80.map((team) => (
            <div key={team.id} className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <span>
                {team.name} - {team.aiUsageThisCycle}/{team.baseAiCredits} credits
              </span>
              <Link href={`/admin/teams/${team.id}`} className="text-cyan-300 hover:text-cyan-200">
                Override
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-semibold">Usage by Action Type</h3>
        <div className="mt-3 space-y-2">
          {topActions.map((item) => (
            <div key={item.actionType} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
              {item.actionType} - {Math.round(item._sum.costInCredits || 0)} credits ({item._count.actionType} calls)
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
