import { prisma } from "@/lib/prisma"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: { action?: string; userId?: string; teamId?: string; start?: string; end?: string }
}) {
  const action = searchParams?.action?.trim() || ""
  const userId = searchParams?.userId?.trim() || ""
  const teamId = searchParams?.teamId?.trim() || ""
  const start = searchParams?.start?.trim() || ""
  const end = searchParams?.end?.trim() || ""
  const startDate = start ? new Date(start) : undefined
  const endDate = end ? new Date(end) : undefined

  const logs = await safeAdminDbQuery(
    () =>
      prisma.adminAuditLog.findMany({
        where: {
          ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
          ...(userId ? { actorId: userId } : {}),
          ...(teamId ? { OR: [{ targetType: "team", targetId: teamId }, { metadata: { path: ["teamId"], equals: teamId } }] } : {}),
          ...(startDate || endDate
            ? {
                createdAt: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          actor: { select: { email: true, name: true } },
        },
      }),
    [] as Array<{
      id: string
      action: string
      targetType: string | null
      targetId: string | null
      createdAt: Date
      ipAddress: string | null
      actor: { email: string; name: string | null }
    }>
  )

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Admin Audit Logs</h2>
      <form className="grid max-w-4xl gap-2 md:grid-cols-5" method="get">
        <input
          name="action"
          defaultValue={action}
          className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm"
          placeholder="Action type"
        />
        <input name="userId" defaultValue={userId} className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm" placeholder="User ID" />
        <input name="teamId" defaultValue={teamId} className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm" placeholder="Team ID" />
        <input name="start" defaultValue={start} className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm" placeholder="Start YYYY-MM-DD" />
        <input name="end" defaultValue={end} className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm" placeholder="End YYYY-MM-DD" />
        <button className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-black">Filter</button>
      </form>

      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="rounded border border-white/10 bg-white/5 p-3 text-sm">
            <p className="font-medium">
              {log.action} <span className="text-white/60">({log.targetType || "n/a"}:{log.targetId || "n/a"})</span>
            </p>
            <p className="text-xs text-white/70">
              {log.actor.name || log.actor.email} | {log.createdAt.toISOString()} | {log.ipAddress || "no-ip"}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
