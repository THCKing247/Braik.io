import { prisma } from "@/lib/prisma"

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: { action?: string }
}) {
  const action = searchParams?.action?.trim() || ""

  const logs = await prisma.adminAuditLog.findMany({
    where: action ? { action } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { email: true, name: true } },
    },
  })

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Admin Audit Logs</h2>
      <form className="flex max-w-md gap-2" method="get">
        <input
          name="action"
          defaultValue={action}
          className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm"
          placeholder="Filter by action"
        />
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
