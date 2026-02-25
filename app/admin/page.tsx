import Link from "next/link"
import { prisma } from "@/lib/prisma"

function sectionCardClassName(extra = ""): string {
  return `rounded-xl border border-white/10 bg-white/5 p-5 ${extra}`.trim()
}

function getDaysFromFilter(value?: string): number {
  const parsed = Number(value)
  if (parsed === 7 || parsed === 30 || parsed === 90) {
    return parsed
  }
  return 30
}

export default async function AdminPortalPage({
  searchParams,
}: {
  searchParams?: { tf?: string }
}) {
  const timeframeDays = getDaysFromFilter(searchParams?.tf)
  const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000)

  const [newUsers, newTeams, activeUsers, ticketVolume, payingTeams, mrrProxy] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.team.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: since } } }),
    prisma.supportTicket.count({ where: { createdAt: { gte: since } } }),
    prisma.team.count({ where: { subscriptionPaid: true } }),
    prisma.team.aggregate({ _sum: { amountPaid: true } }),
  ])

  const maxValue = Math.max(newUsers, newTeams, activeUsers, ticketVolume, 1)
  const chartValues = [
    { label: "New Users", value: newUsers },
    { label: "New Teams", value: newTeams },
    { label: "Active Users", value: activeUsers },
    { label: "Ticket Volume", value: ticketVolume },
  ]

  return (
    <div className="space-y-6">
      <section className={sectionCardClassName()}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Admin Dashboard</h2>
            <p className="text-sm text-white/70">Platform health snapshot with timeframe filters.</p>
          </div>
          <form method="get" className="flex gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                name="tf"
                value={days}
                className={`rounded px-3 py-1 text-sm ${
                  timeframeDays === days ? "bg-cyan-500 text-black" : "bg-white/10 text-white/80"
                }`}
              >
                {days}d
              </button>
            ))}
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className={sectionCardClassName()}>
          <p className="text-xs text-white/70">New Users</p>
          <p className="mt-1 text-2xl font-semibold">{newUsers}</p>
        </div>
        <div className={sectionCardClassName()}>
          <p className="text-xs text-white/70">New Teams</p>
          <p className="mt-1 text-2xl font-semibold">{newTeams}</p>
        </div>
        <div className={sectionCardClassName()}>
          <p className="text-xs text-white/70">Active Users</p>
          <p className="mt-1 text-2xl font-semibold">{activeUsers}</p>
        </div>
        <div className={sectionCardClassName()}>
          <p className="text-xs text-white/70">MRR (placeholder)</p>
          <p className="mt-1 text-2xl font-semibold">${Math.round(mrrProxy._sum.amountPaid || 0)}</p>
        </div>
        <div className={sectionCardClassName()}>
          <p className="text-xs text-white/70">Ticket Volume</p>
          <p className="mt-1 text-2xl font-semibold">{ticketVolume}</p>
        </div>
      </section>

      <section className={sectionCardClassName()}>
        <h3 className="text-lg font-semibold">Charts</h3>
        <div className="mt-4 space-y-3">
          {chartValues.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-xs text-white/80">
                <span>{item.label}</span>
                <span>{item.value}</span>
              </div>
              <div className="h-2 rounded bg-white/10">
                <div
                  className="h-2 rounded bg-cyan-400"
                  style={{ width: `${Math.max(8, Math.round((item.value / maxValue) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionCardClassName()}>
        <h3 className="text-lg font-semibold">Admin Areas</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link href="/admin/users" className="rounded border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            User Management
          </Link>
          <Link href="/admin/teams" className="rounded border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            Team Management
          </Link>
          <Link href="/admin/tickets" className="rounded border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            Support Tickets
          </Link>
          <Link href="/admin/announcements" className="rounded border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            Head Coach Messaging
          </Link>
          <Link href="/admin/audit" className="rounded border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            Audit Logs
          </Link>
          <div className="rounded border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Paying teams: {payingTeams}
          </div>
        </div>
      </section>
    </div>
  )
}
