import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireBillingPermission } from "@/lib/billing-state"
import { createNotifications } from "@/lib/notifications"
import { logMessageSent, logPermissionDenial } from "@/lib/structured-logger"
import { getUserMembership } from "@/lib/rbac"

/**
 * POST /api/messages/send
 * Send a message in a thread
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { threadId, body, attachments } = await request.json()

    if (!threadId || !body) {
      return NextResponse.json(
        { error: "threadId and body are required" },
        { status: 400 }
      )
    }

    // Get thread and check access
    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        participants: true,
      },
    })

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    // Check billing state - read-only mode blocks messaging
    await requireBillingPermission(thread.teamId, "message", prisma)

    // Check if user is a participant
    const participant = thread.participants.find(
      p => p.userId === session.user.id
    )

    if (!participant) {
      const membership = await getUserMembership(thread.teamId)
      logPermissionDenial({
        userId: session.user.id,
        teamId: thread.teamId,
        role: membership?.role,
        reason: "User is not a participant in this thread",
      })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check if user is read-only (parent visibility)
    if (participant.readOnly) {
      const membership = await getUserMembership(thread.teamId)
      logPermissionDenial({
        userId: session.user.id,
        teamId: thread.teamId,
        role: membership?.role,
        reason: "Read-only access: cannot send messages (parent visibility)",
      })
      return NextResponse.json(
        { error: "Read-only access: cannot send messages" },
        { status: 403 }
      )
    }

    // Validate attachments if provided
    if (attachments && Array.isArray(attachments)) {
      // Validate attachment types: PDFs, images, documents, short videos
      const allowedMimeTypes = [
        // PDFs
        "application/pdf",
        // Images
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        // Documents
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
        // Short videos (max 50MB, non-film)
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
      ]

      for (const attachment of attachments) {
        if (!attachment.mimeType || !allowedMimeTypes.includes(attachment.mimeType)) {
          return NextResponse.json(
            { error: `Invalid attachment type: ${attachment.mimeType || "unknown"}` },
            { status: 400 }
          )
        }

        // Check video file size (max 50MB for short videos)
        if (attachment.mimeType.startsWith("video/") && attachment.fileSize) {
          const maxVideoSize = 50 * 1024 * 1024 // 50MB
          if (attachment.fileSize > maxVideoSize) {
            return NextResponse.json(
              { error: "Video files must be 50MB or smaller" },
              { status: 400 }
            )
          }
        }
      }
    }

    // Get existing message count to determine if this is a new thread
    const existingMessageCount = await prisma.message.count({
      where: { threadId },
    })
    const isNewThread = existingMessageCount === 0

    // Create message with attachments
    const message = await prisma.message.create({
      data: {
        threadId,
        body,
        attachments: attachments || null, // Keep for backward compatibility
        createdBy: session.user.id,
        // Create MessageAttachment records for proper metadata tracking
        messageAttachments: attachments && Array.isArray(attachments) ? {
          create: attachments.map((att: any) => ({
            threadId: threadId,
            teamId: thread.teamId,
            fileName: att.fileName || "unknown",
            fileUrl: att.fileUrl, // Secure path from upload
            fileSize: att.fileSize || 0,
            mimeType: att.mimeType || "application/octet-stream",
            uploadedBy: session.user.id,
          })),
        } : undefined,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        messageAttachments: true,
      },
    })

    // Update thread's updatedAt timestamp
    await prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    })

    // Log message sent
    const membership = await getUserMembership(thread.teamId)
    logMessageSent({
      userId: session.user.id,
      teamId: thread.teamId,
      role: membership?.role,
      threadId,
      messageId: message.id,
    })

    // Create notifications for thread participants (exclude sender)
    const participantUserIds = thread.participants
      .map(p => p.userId)
      .filter(id => id !== session.user.id) // Exclude sender

    if (participantUserIds.length > 0) {
      // Determine notification type: "message" for new thread, "thread_reply" for existing
      const notificationType = isNewThread ? "message" : "thread_reply"

      await createNotifications({
        type: notificationType,
        teamId: thread.teamId,
        title: isNewThread
          ? `New message thread: ${thread.subject || "General Chat"}`
          : `New reply in: ${thread.subject || "General Chat"}`,
        body: body.substring(0, 200), // Preview first 200 chars
        linkUrl: `/dashboard/messages?thread=${threadId}`,
        linkType: "message",
        linkId: threadId,
        metadata: {
          threadId,
          threadSubject: thread.subject,
          messageId: message.id,
        },
        targetUserIds: participantUserIds, // Only notify thread participants
      })
    }

    return NextResponse.json(message)
  } catch (error: any) {
    console.error("Send message error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
