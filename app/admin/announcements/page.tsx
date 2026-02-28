import { AdminAnnouncementForm } from "@/components/admin-announcement-form"
import { prisma } from "@/lib/prisma"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"

export default async function AdminAnnouncementsPage() {
  const recent = await safeAdminDbQuery(
    () =>
      prisma.adminAnnouncement.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          creator: { select: { email: true } },
        },
      }),
    [] as Array<{ id: string; scope: string; createdAt: Date; content: string; creator: { email: string } }>
  )

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Admin to Head Coach Messaging</h2>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <AdminAnnouncementForm />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="font-semibold">Recent Announcements</h3>
        <div className="mt-3 space-y-3">
          {recent.map((item) => (
            <div key={item.id} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
              <p className="text-xs text-white/60">
                {item.scope} | {item.createdAt.toISOString().slice(0, 10)} | {item.creator.email}
              </p>
              <p className="mt-1">{item.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
