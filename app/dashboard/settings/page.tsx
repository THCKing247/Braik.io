import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SettingsLayout } from "@/components/settings-layout"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session?.user?.role || !session?.user?.teamId) {
    redirect("/login")
  }

  const userRole = session.user.role
  const teamId = session.user.teamId

  // Head coach and assistant coach can access settings; assistant visibility is section-limited client-side.
  if (!["HEAD_COACH", "ASSISTANT_COACH"].includes(userRole)) {
    redirect("/dashboard")
  }

  // Get team, user, and calendar settings
  const [team, user] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      include: {
        organization: true,
        calendarSettings: true,
        players: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
    }),
  ])

  if (!team || !user) {
    redirect("/dashboard")
  }

  return (
    <SettingsLayout
      user={user}
      team={team}
      userRole={userRole}
    />
  )
}
