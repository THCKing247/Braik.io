import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session?.user?.teamId || !session?.user?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format")
    const teamId = session.user.teamId

    const canAccess = ["HEAD_COACH", "ASSISTANT_COACH"].includes(session.user.role)
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const logs = await prisma.complianceLog.findMany({
      where: {
        metadata: {
          path: ["teamId"],
          equals: teamId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: 300,
    })

    if (format === "csv") {
      if (session.user.role !== "HEAD_COACH") {
        return NextResponse.json({ error: "Only head coaches can export logs" }, { status: 403 })
      }
      const header = "timestamp,event_type,policy_version,user_name,user_email,ip_address"
      const rows = logs.map((log) =>
        [
          log.timestamp.toISOString(),
          log.eventType,
          log.policyVersion,
          `"${(log.user.name || "").replace(/"/g, '""')}"`,
          `"${(log.user.email || "").replace(/"/g, '""')}"`,
          log.ipAddress || "",
        ].join(",")
      )
      return new NextResponse([header, ...rows].join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=compliance-logs.csv",
        },
      })
    }

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error("Compliance logs error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
