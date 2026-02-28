import { prisma } from "@/lib/prisma"
import { listSystemConfig } from "@/lib/system-config-store"
import { SystemSettingsPanel } from "@/components/admin/system-settings-panel"

export default async function AdminSystemSettingsPage() {
  const [rows, teams] = await Promise.all([
    listSystemConfig(250).catch(() => []),
    prisma.team
      .findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 500,
      })
      .catch(() => []),
  ])

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <h2 className="text-xl font-semibold">System Settings</h2>
        <p className="mt-1 text-xs text-white/70">
          AI defaults, billing defaults, and rollout scope controls with immutable version history.
        </p>
      </div>

      <SystemSettingsPanel initialRows={rows} teams={teams} />
    </div>
  )
}
