import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildPlayerFilter } from "@/lib/data-filters"
import { InvoicePageClient } from "@/components/invoice-page-client"


export default async function InvoicePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session?.user?.teamId) {
    redirect("/login")
  }

  const teamId = session.user.teamId
  const userRole = session.user.role
  const positionGroups = session.user.positionGroups as string[] | null | undefined

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      teamId: teamId,
    },
    include: { team: true },
  })

  if (!membership) {
    redirect("/onboarding")
  }

  // Only head coach, assistant coach, and parents can access invoice
  if (!["HEAD_COACH", "ASSISTANT_COACH", "PARENT"].includes(userRole || "")) {
    redirect("/dashboard")
  }

  // Build filter based on role - parents only see their children, assistant coaches see their position groups
  const playerFilter = await buildPlayerFilter(
    session.user.id,
    userRole || "",
    teamId,
    positionGroups
  )

  const [team, players, collections] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      include: {
        players: true,
      },
    }),
    prisma.player.findMany({
      where: playerFilter,
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
        },
        guardianLinks: {
          include: {
            guardian: {
              include: { user: true },
            },
          },
        },
      },
    }),
    prisma.coachPaymentCollection.findMany({
      where: {
        teamId: teamId,
      },
      include: {
        transactions: {
          select: {
            id: true,
            amount: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ])

  if (!team) {
    redirect("/dashboard")
  }

  return (
    <InvoicePageClient
      team={team}
      players={players}
      membership={membership}
      collections={collections}
      currentUserId={session.user.id}
      userRole={userRole || ""}
      positionGroups={positionGroups}
    />
  )
}

