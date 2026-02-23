import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamAccess } from "@/lib/rbac"
import { getDocumentPermissions, canViewDocument } from "@/lib/documents-permissions"
import { getCoordinatorType, getCoordinatorUnit } from "@/lib/calendar-hierarchy"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const teamId = formData.get("teamId") as string
    const title = formData.get("title") as string
    const category = formData.get("category") as string
    const visibility = formData.get("visibility") as string
    const folder = formData.get("folder") as string | null
    const scopedUnit = formData.get("scopedUnit") as string | null
    const scopedPositionGroups = formData.get("scopedPositionGroups") as string | null
    const assignedPlayerIds = formData.get("assignedPlayerIds") as string | null
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    // Check permissions
    const { membership } = await requireTeamAccess(teamId)
    const permissions = await getDocumentPermissions(
      {
        userId: session.user.id,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.positionGroups,
      },
      teamId
    )

    if (!permissions.canCreate) {
      return NextResponse.json({ error: "Insufficient permissions to create documents" }, { status: 403 })
    }

    // Determine scoping based on creator role
    let finalScopedUnit: string | null = scopedUnit || null
    let finalScopedPositionGroups: any = null
    let finalAssignedPlayerIds: any = null

    // If coordinator, scope to their unit
    if (membership.role === "ASSISTANT_COACH") {
      const coordinatorType = getCoordinatorType(membership)
      if (coordinatorType) {
        const unit = getCoordinatorUnit(coordinatorType)
        finalScopedUnit = unit || null
      } else if (membership.positionGroups && Array.isArray(membership.positionGroups)) {
        // Position coach - scope to their position groups
        finalScopedPositionGroups = membership.positionGroups
      }
    }

    // Parse JSON fields if provided
    if (scopedPositionGroups) {
      try {
        finalScopedPositionGroups = JSON.parse(scopedPositionGroups)
      } catch {
        finalScopedPositionGroups = scopedPositionGroups ? [scopedPositionGroups] : null
      }
    }

    if (assignedPlayerIds) {
      try {
        finalAssignedPlayerIds = JSON.parse(assignedPlayerIds)
      } catch {
        finalAssignedPlayerIds = assignedPlayerIds ? [assignedPlayerIds] : null
      }
    }

    // Save file locally (in production, use S3)
    const uploadDir = process.env.UPLOAD_DIR || "./uploads"
    const documentsDir = join(uploadDir, "documents")
    if (!existsSync(documentsDir)) {
      await mkdir(documentsDir, { recursive: true })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const fileName = `${Date.now()}-${sanitizedFileName}`
    const filePath = join(documentsDir, fileName)

    await writeFile(filePath, buffer)

    const document = await prisma.document.create({
      data: {
        teamId,
        title,
        fileName: `/uploads/documents/${fileName}`,
        fileUrl: `/uploads/documents/${fileName}`,
        category,
        folder: folder || null,
        visibility,
        scopedUnit: finalScopedUnit,
        scopedPositionGroups: finalScopedPositionGroups,
        assignedPlayerIds: finalAssignedPlayerIds,
        fileSize: file.size,
        mimeType: file.type,
        createdBy: session.user.id,
      },
      include: {
        creator: { select: { name: true, email: true } },
        acknowledgements: [],
      },
    })

    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "document_uploaded",
        metadata: { documentId: document.id, title, category },
      },
    })

    return NextResponse.json(document)
  } catch (error: any) {
    console.error("Document upload error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const category = searchParams.get("category")
    const folder = searchParams.get("folder")

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    // Check permissions
    const { membership } = await requireTeamAccess(teamId)
    const permissions = await getDocumentPermissions(
      {
        userId: session.user.id,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.positionGroups,
      },
      teamId
    )

    if (!permissions.canView) {
      return NextResponse.json({ error: "Insufficient permissions to view documents" }, { status: 403 })
    }

    // Build filter based on permissions
    const where: any = { teamId }

    if (category) {
      where.category = category
    }

    if (folder) {
      where.folder = folder
    }

    // Apply basic filtering (detailed filtering done via canViewDocument)
    if (permissions.scopedUnit) {
      // Coordinators: prefer documents scoped to their unit, but we'll filter more precisely below
      where.scopedUnit = permissions.scopedUnit
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        creator: { select: { name: true, email: true } },
        acknowledgements: {
          where: { userId: session.user.id },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Filter documents based on canViewDocument check (handles all role-based logic)
    const filteredDocuments = []
    for (const doc of documents) {
      const canView = await canViewDocument(
        {
          userId: session.user.id,
          role: membership.role,
          permissions: membership.permissions,
          positionGroups: membership.positionGroups,
        },
        teamId,
        doc
      )
      if (canView) {
        filteredDocuments.push(doc)
      }
    }

    return NextResponse.json(filteredDocuments)
  } catch (error: any) {
    console.error("Document fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
