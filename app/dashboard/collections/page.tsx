import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { CollectionsOverview } from "@/components/collections-overview"

export default async function CollectionsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session?.user?.teamId) {
    redirect("/login")
  }

  // Verify user is head coach (only head coach can manage collections)
  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      teamId: session.user.teamId,
      role: "HEAD_COACH",
    },
  })

  if (!membership) {
    redirect("/dashboard")
  }

  // Get team, players, and collections
  const [team, collections] = await Promise.all([
    prisma.team.findUnique({
      where: { id: session.user.teamId },
      include: {
        players: {
          orderBy: [
            { lastName: "asc" },
            { firstName: "asc" },
          ],
        },
      },
    }),
    prisma.coachPaymentCollection.findMany({
      where: {
        teamId: session.user.teamId,
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

  // Calculate roster dues collection info
  const playerCount = team.players.length
  const rosterDuesAmount = team.duesAmount * playerCount
  const rosterDuesPaid = team.amountPaid || 0
  const rosterDuesRemaining = rosterDuesAmount - rosterDuesPaid

  return (
    <CollectionsOverview
      teamId={team.id}
      teamName={team.name}
      players={team.players}
      rosterDuesAmount={rosterDuesAmount}
      rosterDuesPaid={rosterDuesPaid}
      rosterDuesRemaining={rosterDuesRemaining}
      rosterDuesStatus={team.subscriptionPaid ? "closed" : "open"}
      customCollections={collections}
    />
  )
}
