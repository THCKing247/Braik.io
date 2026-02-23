import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamAccess } from "@/lib/rbac"
import { getDocumentPermissions } from "@/lib/documents-permissions"

export async function POST(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { linkType, targetId } = body // linkType: "message" | "announcement" | "event"

    if (!linkType || !targetId) {
      return NextResponse.json({ error: "linkType and targetId are required" }, { status: 400 })
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: params.documentId },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Check permissions
    const { membership } = await requireTeamAccess(document.teamId)
    const permissions = await getDocumentPermissions(
      {
        userId: session.user.id,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.positionGroups,
      },
      document.teamId
    )

    if (!permissions.canLink) {
      return NextResponse.json({ error: "Insufficient permissions to link documents" }, { status: 403 })
    }

    // Verify target exists and user has access
    let targetExists = false
    if (linkType === "message") {
      const message = await prisma.message.findUnique({
        where: { id: targetId },
        include: { thread: { include: { participants: true } } },
      })
      if (message) {
        const isParticipant = message.thread.participants.some(
          (p) => p.userId === session.user.id
        )
        targetExists = isParticipant || membership.role === "HEAD_COACH"
      }
    } else if (linkType === "announcement") {
      const announcement = await prisma.announcement.findUnique({
        where: { id: targetId },
      })
      targetExists = announcement !== null && announcement.teamId === document.teamId
    } else if (linkType === "event") {
      const event = await prisma.event.findUnique({
        where: { id: targetId },
      })
      targetExists = event !== null && event.teamId === document.teamId
    }

    if (!targetExists) {
      return NextResponse.json({ error: "Target not found or access denied" }, { status: 404 })
    }

    // Create link
    if (linkType === "message") {
      await prisma.documentMessageLink.create({
        data: {
          documentId: params.documentId,
          messageId: targetId,
        },
      })
    } else if (linkType === "announcement") {
      await prisma.documentAnnouncementLink.create({
        data: {
          documentId: params.documentId,
          announcementId: targetId,
        },
      })
    } else if (linkType === "event") {
      await prisma.documentEventLink.create({
        data: {
          documentId: params.documentId,
          eventId: targetId,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Document link error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const linkType = searchParams.get("linkType")
    const targetId = searchParams.get("targetId")

    if (!linkType || !targetId) {
      return NextResponse.json({ error: "linkType and targetId are required" }, { status: 400 })
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: params.documentId },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Check permissions
    const { membership } = await requireTeamAccess(document.teamId)
    const permissions = await getDocumentPermissions(
      {
        userId: session.user.id,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.positionGroups,
      },
      document.teamId
    )

    if (!permissions.canLink) {
      return NextResponse.json({ error: "Insufficient permissions to unlink documents" }, { status: 403 })
    }

    // Delete link
    if (linkType === "message") {
      await prisma.documentMessageLink.deleteMany({
        where: {
          documentId: params.documentId,
          messageId: targetId,
        },
      })
    } else if (linkType === "announcement") {
      await prisma.documentAnnouncementLink.deleteMany({
        where: {
          documentId: params.documentId,
          announcementId: targetId,
        },
      })
    } else if (linkType === "event") {
      await prisma.documentEventLink.deleteMany({
        where: {
          documentId: params.documentId,
          eventId: targetId,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Document unlink error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
