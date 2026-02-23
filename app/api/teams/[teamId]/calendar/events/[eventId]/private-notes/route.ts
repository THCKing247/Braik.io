import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"

// POST /api/teams/[teamId]/calendar/events/[eventId]/private-notes
// Players can add private notes to events (view-only + private notes per spec)
export async function POST(
  request: Request,
  { params }: { params: { teamId: string; eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, eventId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only players can add private notes
    if (membership.role !== "PLAYER") {
      return NextResponse.json(
        { error: "Only players can add private notes to events" },
        { status: 403 }
      )
    }

    // Verify event exists and is accessible to player
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!event || event.teamId !== teamId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get player record
    const player = await prisma.player.findFirst({
      where: {
        teamId,
        userId: session.user.id,
      },
    })

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const body = await request.json()
    const { note } = body

    if (!note || typeof note !== "string" || note.trim().length === 0) {
      return NextResponse.json(
        { error: "Note is required" },
        { status: 400 }
      )
    }

    // Upsert private note (update if exists, create if not)
    const privateNote = await prisma.eventPrivateNote.upsert({
      where: {
        eventId_playerId: {
          eventId,
          playerId: player.id,
        },
      },
      update: {
        note: note.trim(),
      },
      create: {
        eventId,
        playerId: player.id,
        note: note.trim(),
      },
    })

    return NextResponse.json(privateNote)
  } catch (error: any) {
    console.error("Create private note error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/teams/[teamId]/calendar/events/[eventId]/private-notes
// Get private notes for an event (players see their own, coaches see all)
export async function GET(
  request: Request,
  { params }: { params: { teamId: string; eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, eventId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!event || event.teamId !== teamId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Build query based on role
    const where: any = { eventId }

    if (membership.role === "PLAYER") {
      // Players can only see their own notes
      const player = await prisma.player.findFirst({
        where: {
          teamId,
          userId: session.user.id,
        },
      })

      if (!player) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 })
      }

      where.playerId = player.id
    }
    // Coaches can see all notes (no additional filter)

    const notes = await prisma.eventPrivateNote.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jerseyNumber: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json(notes)
  } catch (error: any) {
    console.error("Get private notes error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
