import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildPlayerFilter } from "@/lib/data-filters"
import { PaymentsManager } from "@/components/payments-manager"
import { CoachPaymentsManager } from "@/components/coach-payments-manager"

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session?.user?.teamId || !session?.user?.role) {
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

  if (!["HEAD_COACH", "PLAYER", "PARENT"].includes(userRole)) {
    redirect("/dashboard")
  }

  // Build filter based on role - parents only see their children, assistant coaches see their position groups
  const playerFilter = await buildPlayerFilter(
    session.user.id,
    userRole,
    teamId,
    positionGroups
  )

  const players = await prisma.player.findMany({
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
  })

  const isHeadCoach = userRole === "HEAD_COACH"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Payments</h1>
        <p style={{ color: "#6B7280" }}>Track team dues and coach-collected payments</p>
      </div>

      {/* Platform Payments (Season Dues) */}
      <div>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111827" }}>Season Dues</h2>
        <PaymentsManager
          team={membership.team}
          players={players}
          membership={membership}
          currentUserId={session.user.id}
        />
      </div>

      {/* Coach-Collected Payments */}
      {isHeadCoach && (
        <div>
          <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111827" }}>Coach-Collected Payments</h2>
          <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
            Payments for gear, camps, fundraisers, and other custom fees collected by the coach
          </p>
          <CoachPaymentsManager teamId={teamId} isHeadCoach={isHeadCoach} />
        </div>
      )}
    </div>
  )
}

