import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"

// GET /api/teams/[teamId]/payments/coach/collections
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

    // Coaches can view all collections, parents/players can view visible ones
    const where: any = { teamId }
    if (membership.role === "PARENT" || membership.role === "PLAYER") {
      where.visibility = "PARENTS_AND_TEAM"
      where.status = "open"
    }

    const collections = await prisma.coachPaymentCollection.findMany({
      where,
      include: {
        creator: { select: { name: true, email: true } },
        transactions: {
          include: {
            collection: true,
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(collections)
  } catch (error: any) {
    console.error("Get collections error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/teams/[teamId]/payments/coach/collections
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

    // Only head coach can create collections
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json(
        { error: "Only head coaches can create payment collections" },
        { status: 403 }
      )
    }

    // Verify payment account is connected
    const account = await prisma.coachPaymentAccount.findUnique({
      where: { teamId },
    })

    if (!account || account.status !== "connected") {
      return NextResponse.json(
        { error: "Please connect a payment account first" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, description, amount, dueDate, visibility } = body

    if (!title || !amount) {
      return NextResponse.json(
        { error: "Title and amount are required" },
        { status: 400 }
      )
    }

    const collection = await prisma.coachPaymentCollection.create({
      data: {
        teamId,
        title,
        description: description || null,
        amount: parseFloat(amount),
        dueDate: dueDate ? new Date(dueDate) : null,
        visibility: visibility || "PARENTS_AND_TEAM",
        status: "open",
        createdBy: session.user.id,
      },
      include: {
        creator: { select: { name: true, email: true } },
      },
    })

    // Create update feed entry
    await prisma.updatesFeed.create({
      data: {
        teamId,
        type: "announcement", // Using announcement type for payment collections
        title: `New payment collection: ${title}`,
        description: `Amount: $${amount}${dueDate ? ` Due: ${new Date(dueDate).toLocaleDateString()}` : ""}`,
        linkType: "payment",
        linkId: collection.id,
        urgency: dueDate && new Date(dueDate) < new Date() ? "high" : "normal",
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "payment_collection_created",
        metadata: { collectionId: collection.id, title, amount },
      },
    })

    return NextResponse.json(collection)
  } catch (error: any) {
    console.error("Create collection error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
