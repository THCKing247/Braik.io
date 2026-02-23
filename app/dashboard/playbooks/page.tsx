import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PlaybooksLanding } from "@/components/playbooks-landing"

export default async function PlaybooksPage() {
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

  // Get playbook permissions (same as documents but filtered to playbooks only)
  const { getDocumentPermissions, canViewDocument } = await import("@/lib/documents-permissions")
  const permissions = await getDocumentPermissions(
    {
      userId: session.user.id,
      role: membership.role,
      permissions: membership.permissions,
      positionGroups: membership.positionGroups,
    },
    membership.teamId
  )

  // Fetch file-based playbooks
  const allPlaybooks = await prisma.document.findMany({
    where: { 
      teamId: membership.teamId,
      category: "playbook" // Only playbooks
    },
    include: {
      creator: { select: { name: true, email: true } },
      acknowledgements: {
        where: { userId: session.user.id },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Filter playbooks based on permissions
  const playbooks = []
  for (const playbook of allPlaybooks) {
    const canView = await canViewDocument(
      {
        userId: session.user.id,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.positionGroups,
      },
      membership.teamId,
      playbook
    )
    if (canView) {
      playbooks.push(playbook)
    }
  }

  // Fetch builder plays
  const allPlays = await prisma.play.findMany({
    where: { teamId: membership.teamId },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [
      { side: "asc" },
      { formation: "asc" },
      { name: "asc" },
    ],
  })

  // Filter plays based on role permissions
  const canViewAll = membership.role === "HEAD_COACH"
  const canViewOffense =
    membership.role === "HEAD_COACH" ||
    (membership.role === "ASSISTANT_COACH" &&
      (membership.permissions as any)?.coordinatorType === "OFFENSIVE_COORDINATOR")
  const canViewDefense =
    membership.role === "HEAD_COACH" ||
    (membership.role === "ASSISTANT_COACH" &&
      (membership.permissions as any)?.coordinatorType === "DEFENSIVE_COORDINATOR")
  const canViewSpecialTeams =
    membership.role === "HEAD_COACH" ||
    (membership.role === "ASSISTANT_COACH" &&
      (membership.permissions as any)?.coordinatorType === "SPECIAL_TEAMS_COORDINATOR")

  const plays = allPlays.filter((play) => {
    if (canViewAll) return true
    return (
      (play.side === "offense" && canViewOffense) ||
      (play.side === "defense" && canViewDefense) ||
      (play.side === "special_teams" && canViewSpecialTeams)
    )
  })

  // Determine edit permissions
  const canEditAll = membership.role === "HEAD_COACH"
  const canEditOffense = canViewOffense && (membership.role === "HEAD_COACH" || membership.role === "ASSISTANT_COACH")
  const canEditDefense = canViewDefense && (membership.role === "HEAD_COACH" || membership.role === "ASSISTANT_COACH")
  const canEditSpecialTeams = canViewSpecialTeams && (membership.role === "HEAD_COACH" || membership.role === "ASSISTANT_COACH")

  return (
    <PlaybooksLanding
      teamId={membership.teamId}
      fileBasedPlaybooks={playbooks}
      builderPlays={plays}
      canUpload={permissions.canCreate}
      canEditAll={canEditAll}
      canEditOffense={canEditOffense}
      canEditDefense={canEditDefense}
      canEditSpecialTeams={canEditSpecialTeams}
      userRole={membership.role}
    />
  )
}
