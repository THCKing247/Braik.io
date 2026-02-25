import { PrismaClient } from "@prisma/client"

export async function requireTeamServiceWriteAccess(
  teamId: string,
  prisma: PrismaClient
): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { serviceStatus: true },
  })

  if (!team) {
    throw new Error("Team not found")
  }

  if (team.serviceStatus === "SUSPENDED") {
    throw new Error("Team is suspended. Editing is disabled until billing is restored.")
  }
}
