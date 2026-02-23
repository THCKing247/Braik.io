import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import { InviteManager } from "@/components/invite-manager"
import { ProgramCodesDisplay } from "@/components/program-codes-display"

export default async function InvitesPage() {
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

  // Only head coaches and assistant coaches can manage invites
  try {
    await requireTeamPermission(membership.teamId, "edit_roster")
  } catch {
    redirect("/dashboard")
  }

  const invites = await prisma.invite.findMany({
    where: { teamId: membership.teamId },
    include: {
      creator: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const userRole = membership.role

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Team Invites</h1>
        <p style={{ color: "#6B7280" }}>Invite assistants, players, and parents to join your team</p>
      </div>

      {/* Program Codes Display */}
      <div className="mb-6">
        <ProgramCodesDisplay teamId={membership.teamId} userRole={userRole} />
      </div>

      {/* Invite Manager */}
      <InviteManager teamId={membership.teamId} invites={invites} />
    </div>
  )
}
