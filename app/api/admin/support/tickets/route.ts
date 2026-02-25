import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"

export async function GET(request: Request) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const url = new URL(request.url)
    const status = url.searchParams.get("status") || undefined
    const query = url.searchParams.get("query") || undefined

    const tickets = await prisma.supportTicket.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query
          ? {
              OR: [
                { subject: { contains: query, mode: "insensitive" } },
                { team: { name: { contains: query, mode: "insensitive" } } },
                { createdByUser: { email: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        teamId: true,
        subject: true,
        status: true,
        category: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        assignedAdminId: true,
        team: { select: { name: true } },
        createdByUser: { select: { email: true, name: true } },
        headCoachUser: { select: { email: true, name: true } },
      },
    })

    return NextResponse.json({ tickets })
  } catch (error: any) {
    console.error("Admin support tickets list error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
