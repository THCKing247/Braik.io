import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamAccess } from "@/lib/rbac"

export async function GET(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: {
        linkedDocuments: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                fileName: true,
                fileUrl: true,
                fileSize: true,
                mimeType: true,
              },
            },
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Check team access
    await requireTeamAccess(event.teamId)

    const documents = event.linkedDocuments.map((link) => link.document)

    return NextResponse.json({ documents })
  } catch (error: any) {
    console.error("Get event documents error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
