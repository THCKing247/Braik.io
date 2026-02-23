import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function POST(
  request: Request,
  { params }: { params: { playerId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const playerId = params.playerId
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    // Get player to check team
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { teamId: true },
    })

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Check permissions
    await requireTeamPermission(player.teamId, "edit_roster")

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      )
    }

    // Save file
    const uploadDir = process.env.UPLOAD_DIR || "./uploads/players"
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileName = `${playerId}-${Date.now()}.${file.name.split(".").pop()}`
    const filePath = join(uploadDir, fileName)
    const fileUrl = `/uploads/players/${fileName}`

    await writeFile(filePath, buffer)

    // Update player with image URL
    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: { imageUrl: fileUrl },
      select: {
        id: true,
        imageUrl: true,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        teamId: player.teamId,
        actorUserId: session.user.id,
        action: "player_image_uploaded",
        metadata: { playerId },
      },
    })

    return NextResponse.json({ imageUrl: updatedPlayer.imageUrl })
  } catch (error: any) {
    console.error("Player image upload error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { playerId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const playerId = params.playerId

    // Get player to check team
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { teamId: true, imageUrl: true },
    })

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Check permissions
    await requireTeamPermission(player.teamId, "edit_roster")

    // Update player to remove image
    await prisma.player.update({
      where: { id: playerId },
      data: { imageUrl: null },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        teamId: player.teamId,
        actorUserId: session.user.id,
        action: "player_image_removed",
        metadata: { playerId },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Player image delete error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
