import { NextResponse } from "next/server"
import { writeFile, mkdir, unlink } from "fs/promises"
import { join } from "path"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { logPlayerProfileActivity, PLAYER_PROFILE_ACTION_TYPES } from "@/lib/player-profile-activity"

/**
 * POST /api/roster/[playerId]/image
 * Uploads a player image. Coaches can upload for any player; players can upload only their own photo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId } = await params
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamAccess((player as { team_id: string }).team_id)
    const membership = await getUserMembership((player as { team_id: string }).team_id)
    const isCoach = membership ? canEditRoster(membership.role) : false
    const isOwnProfile = (player as { user_id: string | null }).user_id === session.user.id
    if (!isCoach && !isOwnProfile) {
      return NextResponse.json({ error: "You can only update your own photo." }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only images are allowed." }, { status: 400 })
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 })
    }

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const secureFileName = `${timestamp}-${random}-${sanitizedName}`

    const uploadsDir = join(process.cwd(), "uploads", "players")
    await mkdir(uploadsDir, { recursive: true })
    const filePath = join(uploadsDir, secureFileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const fileUrl = `/api/uploads/players/${secureFileName}`

    // Update player with image URL
    const { error: updateError } = await supabase
      .from("players")
      .update({ image_url: fileUrl })
      .eq("id", playerId)

    if (updateError) {
      console.error("[POST /api/roster/[playerId]/image]", updateError)
      return NextResponse.json({ error: "Failed to update player image" }, { status: 500 })
    }

    await logPlayerProfileActivity({
      playerId,
      teamId: (player as { team_id: string }).team_id,
      actorId: session.user.id,
      actionType: PLAYER_PROFILE_ACTION_TYPES.PHOTO_CHANGED,
      targetType: "player",
      targetId: playerId,
    })

    return NextResponse.json({ imageUrl: fileUrl })
  } catch (error: any) {
    console.error("[POST /api/roster/[playerId]/image]", error)
  return NextResponse.json(
      { error: error.message || "Failed to upload image" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/roster/[playerId]/image
 * Removes a player image. Coaches can remove any; players can remove only their own.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId } = await params
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, team_id, user_id, image_url")
      .eq("id", playerId)
      .maybeSingle()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamAccess((player as { team_id: string }).team_id)
    const membership = await getUserMembership((player as { team_id: string }).team_id)
    const isCoach = membership ? canEditRoster(membership.role) : false
    const isOwnProfile = (player as { user_id: string | null }).user_id === session.user.id
    if (!isCoach && !isOwnProfile) {
      return NextResponse.json({ error: "You can only remove your own photo." }, { status: 403 })
    }

    const imageUrl = (player as { image_url?: string }).image_url
    if (imageUrl?.startsWith("/api/uploads/players/")) {
      const fileName = imageUrl.replace("/api/uploads/players/", "")
      const filePath = join(process.cwd(), "uploads", "players", fileName)
      try {
        await unlink(filePath)
      } catch {
        // Ignore if file already missing
      }
    }

    // Update player to remove image URL
    const { error: updateError } = await supabase
      .from("players")
      .update({ image_url: null })
      .eq("id", playerId)

    if (updateError) {
      console.error("[DELETE /api/roster/[playerId]/image]", updateError)
      return NextResponse.json({ error: "Failed to remove player image" }, { status: 500 })
    }

    await logPlayerProfileActivity({
      playerId,
      teamId: (player as { team_id: string }).team_id,
      actorId: session.user.id,
      actionType: PLAYER_PROFILE_ACTION_TYPES.PHOTO_REMOVED,
      targetType: "player",
      targetId: playerId,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[DELETE /api/roster/[playerId]/image]", error)
  return NextResponse.json(
      { error: error.message || "Failed to remove image" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
  )
  }
}
