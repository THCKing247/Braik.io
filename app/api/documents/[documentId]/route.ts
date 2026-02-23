import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamAccess } from "@/lib/rbac"
import { canViewDocument } from "@/lib/documents-permissions"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const document = await prisma.document.findUnique({
      where: { id: params.documentId },
      include: {
        team: true,
      },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Check permissions
    const { membership } = await requireTeamAccess(document.teamId)
    const canView = await canViewDocument(
      {
        userId: session.user.id,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.positionGroups,
      },
      document.teamId,
      document
    )

    if (!canView) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Serve the file
    const uploadDir = process.env.UPLOAD_DIR || "./uploads"
    // Extract filename from path (e.g., "/uploads/documents/123-file.pdf" -> "123-file.pdf")
    const fileName = document.fileName.split("/").pop() || document.fileName.replace(/^.*\//, "")
    const filePath = join(process.cwd(), uploadDir, "documents", fileName)

    try {
      const fileBuffer = await readFile(filePath)
      
      // Determine content type
      const contentType = document.mimeType || "application/octet-stream"
      
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${document.fileName}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      })
    } catch (fileError) {
      console.error("File read error:", fileError)
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
  } catch (error: any) {
    console.error("Document serve error:", error)
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

    const document = await prisma.document.findUnique({
      where: { id: params.documentId },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Check permissions
    const { membership } = await requireTeamAccess(document.teamId)
    const { canDeleteDocument } = await import("@/lib/documents-permissions")
    const canDelete = await canDeleteDocument(
      {
        userId: session.user.id,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.positionGroups,
      },
      document.teamId,
      document
    )

    if (!canDelete) {
      return NextResponse.json({ error: "Insufficient permissions to delete document" }, { status: 403 })
    }

    // Delete the document
    await prisma.document.delete({
      where: { id: params.documentId },
    })

    await prisma.auditLog.create({
      data: {
        teamId: document.teamId,
        actorUserId: session.user.id,
        action: "document_deleted",
        metadata: { documentId: document.id, title: document.title },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Document delete error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
