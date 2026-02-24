import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

/**
 * POST /api/messages/attachments
 * Upload an attachment for messaging (PDFs, images, documents, short videos)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const teamId = formData.get("teamId") as string
    const file = formData.get("file") as File

    if (!file || !teamId) {
      return NextResponse.json(
        { error: "File and teamId are required" },
        { status: 400 }
      )
    }

    // Verify user has access to team
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        teamId,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Validate file type
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

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not supported. Allowed: PDFs, images, documents, and short videos (max 50MB)" },
        { status: 400 }
      )
    }

    // Enforce size limits
    const maxFileSize = 100 * 1024 * 1024 // 100MB general limit
    const maxVideoSize = 50 * 1024 * 1024 // 50MB for videos (short clips only, non-film)
    const maxImageSize = 10 * 1024 * 1024 // 10MB for images
    const maxDocumentSize = 25 * 1024 * 1024 // 25MB for documents

    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: "File size exceeds maximum limit of 100MB" },
        { status: 400 }
      )
    }

    // Check video file size (max 50MB for short videos, non-film)
    if (file.type.startsWith("video/")) {
      if (file.size > maxVideoSize) {
        return NextResponse.json(
          { error: "Video files must be 50MB or smaller (short clips only, not film)" },
          { status: 400 }
        )
      }
    }

    // Check image file size
    if (file.type.startsWith("image/")) {
      if (file.size > maxImageSize) {
        return NextResponse.json(
          { error: "Image files must be 10MB or smaller" },
          { status: 400 }
        )
      }
    }

    // Check document file size
    if (file.type.includes("document") || file.type.includes("pdf") || 
        file.type.includes("msword") || file.type.includes("excel") ||
        file.type === "text/plain" || file.type === "text/csv") {
      if (file.size > maxDocumentSize) {
        return NextResponse.json(
          { error: "Document files must be 25MB or smaller" },
          { status: 400 }
        )
      }
    }

    // Save file locally (in production, use S3)
    const uploadDir = process.env.UPLOAD_DIR || "./uploads/messages"
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    // Store file with secure naming (timestamp + random + sanitized name)
    const secureFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
    const filePath = join(uploadDir, secureFileName)
    await writeFile(filePath, buffer)

    // Return secure file path (not public URL - will be served through secure endpoint)
    const secureFileUrl = `messages/${secureFileName}` // Relative path for secure serving

    return NextResponse.json({
      fileUrl: secureFileUrl, // Secure path, not public URL
      fileName: file.name, // Original filename for display
      fileSize: file.size,
      mimeType: file.type,
    })
  } catch (error: any) {
    console.error("Upload attachment error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
