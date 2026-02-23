import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { getInventoryPermissions, canAssignToPlayer } from "@/lib/inventory-permissions"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// PATCH /api/teams/[teamId]/inventory/[itemId]
export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, itemId } = params
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

    if (!permissions.canEdit) {
      return NextResponse.json(
        { error: "You do not have permission to edit inventory items" },
        { status: 403 }
      )
    }

    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
    })

    if (!existingItem || existingItem.teamId !== teamId) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    // Check if request is FormData (has files) or JSON
    const contentType = request.headers.get("content-type") || ""
    let body: any = {}
    let files: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      body = {
        category: formData.get("category"),
        name: formData.get("name"),
        quantityTotal: formData.get("quantityTotal"),
        quantityAvailable: formData.get("quantityAvailable"),
        condition: formData.get("condition"),
        assignedToPlayerId: formData.get("assignedToPlayerId"),
        notes: formData.get("notes"),
        status: formData.get("status"),
      }
      
      // Get all files
      const filesData = formData.getAll("files") as File[]
      files = filesData.filter(file => file instanceof File && file.size > 0)
    } else {
      body = await request.json()
    }

    const updateData: any = {}
    const transactionData: any = {}

    // Track what changed for transaction history
    const previousStatus = existingItem.status
    const previousPlayerId = existingItem.assignedToPlayerId

    // Only allow editing certain fields based on permissions
    // Head coaches and coordinators can edit all fields
    // Position coaches can only assign/unassign items
    if (permissions.canEdit) {
      if (body.category !== undefined) updateData.category = body.category
      if (body.name !== undefined) updateData.name = body.name
      if (body.quantityTotal !== undefined) updateData.quantityTotal = parseInt(body.quantityTotal)
      if (body.quantityAvailable !== undefined)
        updateData.quantityAvailable = parseInt(body.quantityAvailable)
      if (body.condition !== undefined) updateData.condition = body.condition
      if (body.notes !== undefined) updateData.notes = body.notes
    }

    // Assignment changes require canAssign permission
    if (body.assignedToPlayerId !== undefined) {
      const newPlayerId = body.assignedToPlayerId || null

      if (newPlayerId) {
        // Check if user can assign to this player
        const canAssign = await canAssignToPlayer(
          {
            userId: membership.userId,
            role: membership.role,
            permissions: membership.permissions,
            positionGroups: membership.permissions?.positionGroups,
          },
          teamId,
          newPlayerId
        )

        if (!canAssign) {
          return NextResponse.json(
            { error: "You do not have permission to assign items to this player" },
            { status: 403 }
          )
        }
      }

      updateData.assignedToPlayerId = newPlayerId

      // Track assignment/unassignment
      if (previousPlayerId && !newPlayerId) {
        // Return
        transactionData.transactionType = "RETURN"
        transactionData.notes = "Item returned"
      } else if (!previousPlayerId && newPlayerId) {
        // Issue
        transactionData.transactionType = "ISSUE"
        transactionData.playerId = newPlayerId
        transactionData.notes = "Item issued to player"
      } else if (previousPlayerId !== newPlayerId) {
        // Reassignment
        transactionData.transactionType = "ISSUE"
        transactionData.playerId = newPlayerId
        transactionData.notes = `Item reassigned from previous player`
      }
    }

    // Status changes
    if (body.status !== undefined && body.status !== previousStatus) {
      updateData.status = body.status
      if (!transactionData.transactionType) {
        transactionData.transactionType = "STATUS_CHANGE"
      }
      transactionData.previousStatus = previousStatus
      transactionData.newStatus = body.status
    }

    // Handle file uploads
    if (files.length > 0) {
      const uploadDir = process.env.UPLOAD_DIR || "./uploads"
      const inventoryDir = join(uploadDir, "inventory")
      if (!existsSync(inventoryDir)) {
        await mkdir(inventoryDir, { recursive: true })
      }

      const uploadedFiles: Array<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }> = []
      
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

      // Merge with existing files if any
      const existingFiles = existingItem.files ? (existingItem.files as any[]) : []
      updateData.files = [...existingFiles, ...uploadedFiles]
    }

    const item = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: updateData,
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

    // Create transaction record if there was a meaningful change
    if (transactionData.transactionType) {
      await prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          teamId,
          transactionType: transactionData.transactionType,
          playerId: transactionData.playerId || existingItem.assignedToPlayerId || null,
          performedByUserId: session.user.id,
          previousStatus: transactionData.previousStatus || previousStatus,
          newStatus: transactionData.newStatus || item.status,
          notes: transactionData.notes || body.notes || null,
        },
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "inventory_item_updated",
        metadata: { itemId, changes: body },
      },
    })

    return NextResponse.json(item)
  } catch (error: any) {
    console.error("Update inventory error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/teams/[teamId]/inventory/[itemId]
export async function DELETE(
  request: Request,
  { params }: { params: { teamId: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, itemId } = params
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

    // Only head coach can delete
    if (!permissions.canDelete) {
      return NextResponse.json(
        { error: "Only head coaches can delete inventory items" },
        { status: 403 }
      )
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
    })

    if (!item || item.teamId !== teamId) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    await prisma.inventoryItem.delete({
      where: { id: itemId },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "inventory_item_deleted",
        metadata: { itemId, name: item.name },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete inventory error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
