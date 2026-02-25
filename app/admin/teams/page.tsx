import { AdminTeamStatusForm } from "@/components/admin-team-status-form"
import { prisma } from "@/lib/prisma"

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams?: { q?: string }
}) {
  const query = searchParams?.q?.trim() || ""

  const teams = await prisma.team.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { organization: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      planTier: true,
      serviceStatus: true,
      organization: { select: { name: true } },
      players: { select: { id: true } },
      memberships: { where: { role: { in: ["HEAD_COACH", "ASSISTANT_COACH"] } }, select: { userId: true } },
    },
  })

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Team Management</h2>
      <form className="flex max-w-lg gap-2" method="get">
        <input
          name="q"
          defaultValue={query}
          className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm"
          placeholder="Search team or organization"
        />
        <button className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-black">Search</button>
      </form>

      <div className="space-y-3">
        {teams.map((team) => (
          <div key={team.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{team.name}</h3>
                <p className="text-xs text-white/70">{team.organization.name}</p>
                <p className="mt-1 text-xs text-white/70">
                  Plan: {team.planTier || "starter"} | Roster: {team.players.length} | Coaches: {team.memberships.length}
                </p>
              </div>
              <div>
                <AdminTeamStatusForm teamId={team.id} initialStatus={team.serviceStatus} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
