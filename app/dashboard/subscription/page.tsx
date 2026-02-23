import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SubscriptionManager } from "@/components/subscription-manager"

export default async function SubscriptionPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session?.user?.teamId) {
    redirect("/login")
  }

  // Verify user is head coach or assistant coach (read-only for assistant)
  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      teamId: session.user.teamId,
      role: { in: ["HEAD_COACH", "ASSISTANT_COACH"] },
    },
  })

  if (!membership) {
    redirect("/dashboard")
  }

  const isHeadCoach = membership.role === "HEAD_COACH"

  const team = await prisma.team.findUnique({
    where: { id: session.user.teamId },
    include: {
      players: true,
    },
  })

  if (!team) {
    redirect("/dashboard")
  }

  const playerCount = team.players.length
  const subscriptionAmount = playerCount * 5.0 // $5 per player
  const remainingBalance = subscriptionAmount - (team.amountPaid || 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-[#FFFFFF]">Subscription</h1>
        <p className="text-[#FFFFFF]/80">Manage your team subscription and payment information</p>
      </div>

      <SubscriptionManager
        team={team}
        playerCount={playerCount}
        subscriptionAmount={subscriptionAmount}
        amountPaid={team.amountPaid || 0}
        remainingBalance={remainingBalance}
        subscriptionPaid={team.subscriptionPaid || false}
        isHeadCoach={isHeadCoach}
        teamIdCode={team.teamIdCode || ""}
      />
    </div>
  )
}
