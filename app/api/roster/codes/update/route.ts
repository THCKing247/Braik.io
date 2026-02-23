import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

/**
 * POST /api/roster/codes/update
 * Update program codes (Platform Owner only)
 * Can be called by Platform Owner per Head Coach or user request
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is Platform Owner
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isPlatformOwner: true },
    })

    if (!user?.isPlatformOwner) {
      return NextResponse.json({ error: "Access denied: Platform Owner only" }, { status: 403 })
    }

    const { teamId, playerCode, parentCode } = await request.json()

    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 })
    }

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Update codes (only if provided)
    const updateData: any = {}
    if (playerCode !== undefined) {
      // Validate format (8 characters alphanumeric)
      if (playerCode && (!/^[A-Z0-9]{8}$/.test(playerCode.toUpperCase()))) {
        return NextResponse.json({ error: "Player code must be 8 alphanumeric characters" }, { status: 400 })
      }
      updateData.playerCode = playerCode ? playerCode.toUpperCase() : null
    }
    if (parentCode !== undefined) {
      // Validate format (8 characters alphanumeric)
      if (parentCode && (!/^[A-Z0-9]{8}$/.test(parentCode.toUpperCase()))) {
        return NextResponse.json({ error: "Parent code must be 8 alphanumeric characters" }, { status: 400 })
      }
      updateData.parentCode = parentCode ? parentCode.toUpperCase() : null
    }

    // Check for uniqueness if codes are being set
    if (updateData.playerCode) {
      const existingPlayerCode = await prisma.team.findFirst({
        where: {
          playerCode: updateData.playerCode,
          id: { not: teamId },
        },
      })
      if (existingPlayerCode) {
        return NextResponse.json({ error: "Player code already in use" }, { status: 400 })
      }
    }

    if (updateData.parentCode) {
      const existingParentCode = await prisma.team.findFirst({
        where: {
          parentCode: updateData.parentCode,
          id: { not: teamId },
        },
      })
      if (existingParentCode) {
        return NextResponse.json({ error: "Parent code already in use" }, { status: 400 })
      }
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
      select: {
        id: true,
        playerCode: true,
        parentCode: true,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "program_codes_updated",
        metadata: {
          playerCode: updatedTeam.playerCode,
          parentCode: updatedTeam.parentCode,
          updatedBy: "platform_owner",
        },
      },
    })

    return NextResponse.json({
      success: true,
      playerCode: updatedTeam.playerCode,
      parentCode: updatedTeam.parentCode,
    })
  } catch (error: any) {
    console.error("Update codes error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
