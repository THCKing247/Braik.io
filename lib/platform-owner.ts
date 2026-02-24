import { prisma } from "@/lib/prisma"

export async function isPlatformOwner(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformOwner: true },
  })

  return !!user?.isPlatformOwner
}

