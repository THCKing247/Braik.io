import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"

// PATCH /api/teams/[teamId]/payments/coach/collections/[collectionId]
export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string; collectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, collectionId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only head coach can update collections
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json(
        { error: "Only head coaches can update collections" },
        { status: 403 }
      )
    }

    const collection = await prisma.coachPaymentCollection.findUnique({
      where: { id: collectionId },
    })

    if (!collection || collection.teamId !== teamId) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 })
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount)
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.visibility !== undefined) updateData.visibility = body.visibility
    if (body.status !== undefined) updateData.status = body.status

    const updated = await prisma.coachPaymentCollection.update({
      where: { id: collectionId },
      data: updateData,
      include: {
        creator: { select: { name: true, email: true } },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "payment_collection_updated",
        metadata: { collectionId, changes: body },
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Update collection error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/teams/[teamId]/payments/coach/collections/[collectionId]
export async function DELETE(
  request: Request,
  { params }: { params: { teamId: string; collectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, collectionId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only head coach can delete collections
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json(
        { error: "Only head coaches can delete collections" },
        { status: 403 }
      )
    }

    const collection = await prisma.coachPaymentCollection.findUnique({
      where: { id: collectionId },
    })

    if (!collection || collection.teamId !== teamId) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 })
    }

    await prisma.coachPaymentCollection.delete({
      where: { id: collectionId },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "payment_collection_deleted",
        metadata: { collectionId, title: collection.title },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete collection error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
