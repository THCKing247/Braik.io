import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { getInventoryPermissions, canViewInventoryItem } from "@/lib/inventory-permissions"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// GET /api/teams/[teamId]/inventory
export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const permissions = await getInventoryPermissions(
      {
        userId: membership.userId,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.permissions?.positionGroups,
      },
      teamId
    )

    if (!permissions.canView) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")

    const where: any = { teamId }

    // Filter by scoped players if user can't view all items
    if (!permissions.canViewAll && permissions.scopedPlayerIds) {
      if (permissions.scopedPlayerIds.length === 0) {
        // Player with no assigned items - they can only see items assigned to them (none)
        return NextResponse.json([])
      }
      // For coordinators/position coaches: show items assigned to their players OR unassigned items
      // For players: only show items assigned to them
      if (membership.role === "PLAYER") {
        where.assignedToPlayerId = { in: permissions.scopedPlayerIds }
      } else {
        // Coordinators and position coaches can see unassigned items + items assigned to their players
        where.OR = [
          { assignedToPlayerId: { in: permissions.scopedPlayerIds } },
          { assignedToPlayerId: null },
        ]
      }
    }

    if (category) where.category = category
    if (status) where.status = status

    const items = await prisma.inventoryItem.findMany({
      where,
      include: {
        assignedPlayer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jerseyNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Additional permission check for each item (for players viewing assigned items)
    const filteredItems = []
    for (const item of items) {
      const canView = await canViewInventoryItem(
        {
          userId: membership.userId,
          role: membership.role,
          permissions: membership.permissions,
          positionGroups: membership.permissions?.positionGroups,
        },
        teamId,
        item
      )
      if (canView) {
        filteredItems.push(item)
      }
    }

    return NextResponse.json(filteredItems)
  } catch (error: any) {
    console.error("Get inventory error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/teams/[teamId]/inventory
export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const permissions = await getInventoryPermissions(
      {
        userId: membership.userId,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.permissions?.positionGroups,
      },
      teamId
    )

    if (!permissions.canCreate) {
      return NextResponse.json(
        { error: "You do not have permission to create inventory items" },
        { status: 403 }
      )
    }

    // Check if request is FormData (has files) or JSON
    const contentType = request.headers.get("content-type") || ""
    let category: string
    let name: string
    let quantityTotal: string
    let quantityAvailable: string
    let condition: string
    let assignedToPlayerId: string | null
    let notes: string | null
    let status: string
    let files: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      category = formData.get("category") as string
      name = formData.get("name") as string
      quantityTotal = formData.get("quantityTotal") as string
      quantityAvailable = formData.get("quantityAvailable") as string
      condition = formData.get("condition") as string
      assignedToPlayerId = formData.get("assignedToPlayerId") as string || null
      notes = formData.get("notes") as string || null
      status = formData.get("status") as string
      
      // Get all files
      const filesData = formData.getAll("files") as File[]
      files = filesData.filter(file => file instanceof File && file.size > 0)
    } else {
      const body = await request.json()
      category = body.category
      name = body.name
      quantityTotal = body.quantityTotal
      quantityAvailable = body.quantityAvailable
      condition = body.condition
      assignedToPlayerId = body.assignedToPlayerId || null
      notes = body.notes || null
      status = body.status
    }

    // If assigning to a player, check if user can assign to that player
    if (assignedToPlayerId) {
      const { canAssignToPlayer } = await import("@/lib/inventory-permissions")
      const canAssign = await canAssignToPlayer(
        {
          userId: membership.userId,
          role: membership.role,
          permissions: membership.permissions,
          positionGroups: membership.permissions?.positionGroups,
        },
        teamId,
        assignedToPlayerId
      )

      if (!canAssign) {
        return NextResponse.json(
          { error: "You do not have permission to assign items to this player" },
          { status: 403 }
        )
      }
    }

    // Handle file uploads
    const uploadedFiles: Array<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }> = []
    
    if (files.length > 0) {
      const uploadDir = process.env.UPLOAD_DIR || "./uploads"
      const inventoryDir = join(uploadDir, "inventory")
      if (!existsSync(inventoryDir)) {
        await mkdir(inventoryDir, { recursive: true })
      }

      for (const file of files) {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
        const fileName = `${Date.now()}-${sanitizedFileName}`
        const filePath = join(inventoryDir, fileName)

        await writeFile(filePath, buffer)

        uploadedFiles.push({
          fileName: file.name,
          fileUrl: `/uploads/inventory/${fileName}`,
          fileSize: file.size,
          mimeType: file.type,
        })
      }
    }

    const item = await prisma.inventoryItem.create({
      data: {
        teamId,
        category,
        name,
        quantityTotal: parseInt(quantityTotal),
        quantityAvailable: parseInt(quantityAvailable || quantityTotal),
        condition: condition || "GOOD",
        assignedToPlayerId: assignedToPlayerId || null,
        notes: notes || null,
        status: status || "AVAILABLE",
        files: uploadedFiles.length > 0 ? uploadedFiles : null,
      },
      include: {
        assignedPlayer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    // Create transaction record if assigned
    if (assignedToPlayerId) {
      await prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          teamId,
          transactionType: "ISSUE",
          playerId: assignedToPlayerId,
          performedByUserId: session.user.id,
          newStatus: status || "ASSIGNED",
          notes: `Item issued to player`,
        },
      })
    }

    // Create update feed entry
    await prisma.updatesFeed.create({
      data: {
        teamId,
        type: "inventory_update",
        title: `New inventory item: ${name}`,
        description: `${quantityTotal} ${name} added to inventory`,
        linkType: "inventory",
        linkId: item.id,
        urgency: "normal",
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "inventory_item_created",
        metadata: { itemId: item.id, name, category },
      },
    })

    return NextResponse.json(item)
  } catch (error: any) {
    console.error("Create inventory error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
