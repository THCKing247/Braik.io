import { prisma } from "@/lib/prisma"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string }
}) {
  const query = searchParams?.q?.trim() || ""

  const users = await prisma.user.findMany({
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
  })

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">User Management</h2>
      <form className="flex max-w-lg gap-2" method="get">
        <input
          name="q"
          defaultValue={query}
          className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm"
          placeholder="Search email or name"
        />
        <button className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-black">Search</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Team(s)</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-white/10">
                <td className="px-3 py-2">
                  <p className="font-medium">{user.name || "Unnamed"}</p>
                  <p className="text-xs text-white/70">{user.email}</p>
                </td>
                <td className="px-3 py-2">{user.role}</td>
                <td className="px-3 py-2">
                  {user.memberships.length
                    ? user.memberships.map((membership) => `${membership.team.name} (${membership.role})`).join(", ")
                    : "No teams"}
                </td>
                <td className="px-3 py-2">{user.status}</td>
                <td className="px-3 py-2">{user.createdAt.toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2">{user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 10) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
