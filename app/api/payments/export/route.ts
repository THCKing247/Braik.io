import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")

    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "view_payments")

    const players = await prisma.player.findMany({
      where: { teamId },
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    })

    const csv = [
      ["Player Name", "Status", "Amount", "Paid Date"].join(","),
      ...players.map((player) => {
        const payment = player.payments[0]
        return [
          `"${player.firstName} ${player.lastName}"`,
          payment?.status === "completed" ? "Paid" : "Unpaid",
          payment?.amount || "",
          payment?.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "",
        ].join(",")
      }),
    ].join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

