import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

/**
 * POST /api/roster/[playerId]/image
 * Uploads a player image.
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

    // Get player to verify team access
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamPermission(player.team_id, "edit_roster")

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

    // TODO: Upload to Supabase Storage or file system
    // For now, generate a URL (would be replaced with actual Storage upload)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const secureFileName = `${timestamp}-${random}-${sanitizedName}`
    const fileUrl = `./uploads/players/${secureFileName}`

    // In production: await supabase.storage.from('player-images').upload(secureFileName, file)

    // Update player with image URL
    const { error: updateError } = await supabase
      .from("players")
      .update({ image_url: fileUrl })
      .eq("id", playerId)

    if (updateError) {
      console.error("[POST /api/roster/[playerId]/image]", updateError)
      return NextResponse.json({ error: "Failed to update player image" }, { status: 500 })
    }

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
 * Removes a player image.
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

    // Get player to verify team access
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, team_id, image_url")
      .eq("id", playerId)
      .maybeSingle()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamPermission(player.team_id, "edit_roster")

    // TODO: Delete from Supabase Storage if using Storage
    // if (player.image_url) {
    //   await supabase.storage.from('player-images').remove([player.image_url])
    // }

    // Update player to remove image URL
    const { error: updateError } = await supabase
      .from("players")
      .update({ image_url: null })
      .eq("id", playerId)

    if (updateError) {
      console.error("[DELETE /api/roster/[playerId]/image]", updateError)
      return NextResponse.json({ error: "Failed to remove player image" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[DELETE /api/roster/[playerId]/image]", error)
    return NextResponse.json(
      { error: error.message || "Failed to remove image" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
