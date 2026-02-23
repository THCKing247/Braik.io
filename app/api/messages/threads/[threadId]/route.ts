import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/messages/threads/[threadId]
 * Get a specific thread with messages
 */
export async function GET(
  request: Request,
  { params }: { params: { threadId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const before = searchParams.get("before") // Message ID to paginate before

    const thread = await prisma.messageThread.findUnique({
      where: { id: params.threadId },
      include: {
        team: {
          include: {
            organization: true,
          },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    })

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    // Check if user is a participant
    const isParticipant = thread.participants.some(
      p => p.userId === session.user.id
    )

    if (!isParticipant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get messages
    const messagesWhere: any = { threadId: params.threadId }
    if (before) {
      const beforeMessage = await prisma.message.findUnique({
        where: { id: before },
      })
      if (beforeMessage) {
        messagesWhere.createdAt = { lt: beforeMessage.createdAt }
      }
    }

    const messages = await prisma.message.findMany({
      where: messagesWhere,
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        messageAttachments: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    // Check if user is read-only
    const participant = thread.participants.find(p => p.userId === session.user.id)
    const isReadOnly = participant?.readOnly || false

    // Transform messages to include messageAttachments in attachments array for backward compatibility
    const transformedMessages = messages.reverse().map((msg: any) => ({
      ...msg,
      // Merge messageAttachments into attachments array if attachments is null/empty
      // This ensures backward compatibility while supporting new MessageAttachment records
      attachments: msg.attachments || (msg.messageAttachments?.length > 0
        ? msg.messageAttachments.map((att: any) => ({
            id: att.id,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
          }))
        : null),
    }))

    return NextResponse.json({
      ...thread,
      messages: transformedMessages,
      isReadOnly,
      canReply: !isReadOnly,
    })
  } catch (error: any) {
    console.error("Get thread error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
