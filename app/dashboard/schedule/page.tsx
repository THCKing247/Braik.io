import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ScheduleManager } from "@/components/schedule-manager"

export default async function SchedulePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { 
      team: {
        include: {
          calendarSettings: true,
        },
      },
    },
  })

  if (!membership) {
    redirect("/onboarding")
  }

  const events = await prisma.event.findMany({
    where: { teamId: membership.teamId },
    include: {
      creator: { select: { name: true, email: true } },
      rsvps: {
        include: {
          player: { select: { firstName: true, lastName: true } },
        },
      },
      linkedDocuments: {
        include: {
          document: {
            select: {
              id: true,
              title: true,
              fileName: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
            },
          },
        },
      },
    },
    orderBy: { start: "asc" },
  })

  const calendarSettings = membership.team.calendarSettings || {
    defaultView: "day",
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Schedule</h1>
        <p style={{ color: "#6B7280" }}>View and manage team events</p>
      </div>
      <ScheduleManager 
        teamId={membership.teamId} 
        events={events} 
        canEdit={membership.role === "HEAD_COACH" || membership.role === "ASSISTANT_COACH"}
        defaultView={calendarSettings.defaultView as "day" | "week" | "month"}
      />
    </div>
  )
}

