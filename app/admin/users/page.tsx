import { prisma } from "@/lib/prisma"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"
import { OperatorUsers } from "@/components/admin/operator-users"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string }
}) {
  const query = searchParams?.q?.trim() || ""

  const users = await safeAdminDbQuery(
    () =>
      prisma.user.findMany({
        where: query
          ? {
              OR: [
                { email: { contains: query, mode: "insensitive" } },
                { name: { contains: query, mode: "insensitive" } },
              ],
            }
          : undefined,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          memberships: {
            select: {
              role: true,
              team: { select: { id: true, name: true } },
            },
          },
        },
      }),
    [] as Array<{
      id: string
      email: string
      name: string | null
      role: string
      status: string
      createdAt: Date
      lastLoginAt: Date | null
      memberships: Array<{ role: string; team: { id: string; name: string } }>
    }>
  )

  return (
    <OperatorUsers
      users={users.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      }))}
    />
  )
}
