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
    const action = url.searchParams.get("action") || undefined
    const targetType = url.searchParams.get("targetType") || undefined

    const logs = await prisma.adminAuditLog.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(targetType ? { targetType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        actorId: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error("Admin audit logs error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
