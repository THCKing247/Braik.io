import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { getParentAccessiblePlayerIds } from "@/lib/data-filters"
import { isHighSchoolTeam } from "@/lib/messaging-permissions"

/**
 * GET /api/messages/attachments/[attachmentId]
 * Securely serve message attachments with access control
 */
export async function GET(
  request: Request,
  { params }: { params: { attachmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get attachment with related data
    const attachment = await prisma.messageAttachment.findUnique({
      where: { id: params.attachmentId },
      include: {
        message: {
          include: {
            thread: {
              include: {
                team: {
                  include: {
                    organization: true,
                  },
                },
                participants: true,
              },
            },
          },
        },
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    const thread = attachment.message.thread
    const team = thread.team
    const userRole = await getUserRole(session.user.id, team.id)

    // Check access based on role and thread participation
    const hasAccess = await checkAttachmentAccess(
      session.user.id,
      userRole,
      thread,
      team,
      attachment
    )

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Construct file path from secure fileUrl
    const filePath = join(process.cwd(), "uploads", attachment.fileUrl)

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Read and serve file
    const file = await readFile(filePath)
    const contentType = getContentType(attachment.fileName, attachment.mimeType)

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${attachment.fileName}"`,
        "Cache-Control": "private, max-age=3600", // Cache for 1 hour
      },
    })
  } catch (error: any) {
    console.error("Serve attachment error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Check if user has access to attachment based on role and thread participation
 */
async function checkAttachmentAccess(
  userId: string,
  userRole: string | null,
  thread: any,
  team: any,
  attachment: any
): Promise<boolean> {
  // Check if user is a direct participant in the thread
  const isDirectParticipant = thread.participants.some(
    (p: any) => p.userId === userId
  )

  if (isDirectParticipant) {
    // Direct participants always have access
    return true
  }

  // For parents (HS only): check if they can view threads involving their child
  if (userRole === "PARENT") {
    const isHS = isHighSchoolTeam(team.organization?.type)
    if (!isHS) {
      return false // Parent visibility only applies to HS
    }

    // Get accessible player IDs for this parent
    const accessiblePlayerIds = await getParentAccessiblePlayerIds(userId, team.id)

    if (accessiblePlayerIds.length === 0) {
      return false
    }

    // Get player user IDs
    const players = await prisma.player.findMany({
      where: {
        id: { in: accessiblePlayerIds },
        userId: { not: null },
      },
      select: { userId: true },
    })

    const childUserIds = players.map((p) => p.userId).filter(Boolean) as string[]

    // Check if any child is a participant in this thread
    const hasChildParticipant = thread.participants.some((p: any) =>
      childUserIds.includes(p.userId)
    )

    return hasChildParticipant
  }

  // Platform Owner can access all attachments (for disputes)
  if (userRole === "PLATFORM_OWNER") {
    return true
  }

  // Default: no access
  return false
}

/**
 * Get user's role in a team
 */
async function getUserRole(userId: string, teamId: string): Promise<string | null> {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      teamId,
    },
    select: { role: true },
  })

  return membership?.role || null
}

/**
 * Get content type from filename and mime type
 */
function getContentType(fileName: string, mimeType: string): string {
  // Use provided mimeType if available
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType
  }

  // Fallback to extension-based detection
  const ext = fileName.split(".").pop()?.toLowerCase()
  const types: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    csv: "text/csv",
  }

  return types[ext || ""] || "application/octet-stream"
}
