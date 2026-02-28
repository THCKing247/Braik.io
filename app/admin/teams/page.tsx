import { prisma } from "@/lib/prisma"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"
import { OperatorTeams } from "@/components/admin/operator-teams"

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams?: { q?: string }
}) {
  const query = searchParams?.q?.trim() || ""

  const teams = await safeAdminDbQuery(
    () =>
      prisma.team.findMany({
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
          subscriptionStatus: true,
          teamStatus: true,
          organization: { select: { name: true } },
          players: { select: { id: true } },
          memberships: { where: { role: { in: ["HEAD_COACH", "ASSISTANT_COACH"] } }, select: { userId: true } },
        },
      }),
    [] as Array<{
      id: string
      name: string
      planTier: string | null
      subscriptionStatus: string
      teamStatus: string
      organization: { name: string }
      players: Array<{ id: string }>
      memberships: Array<{ userId: string }>
    }>
  )

  return (
    <OperatorTeams teams={teams} />
  )
}
