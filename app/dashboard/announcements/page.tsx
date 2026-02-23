import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AnnouncementsManager } from "@/components/announcements-manager"

export default async function AnnouncementsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  })

  if (!membership) {
    redirect("/onboarding")
  }

  const announcements = await prisma.announcement.findMany({
    where: { teamId: membership.teamId },
    include: {
      creator: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Announcements</h1>
        <p style={{ color: "#6B7280" }}>Team announcements and updates</p>
      </div>
      <AnnouncementsManager teamId={membership.teamId} announcements={announcements} canPost={membership.role === "HEAD_COACH" || membership.role === "ASSISTANT_COACH"} />
    </div>
  )
}

