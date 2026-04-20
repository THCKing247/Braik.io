import { NextResponse } from "next/server"
import sharp from "sharp"
import { unlink } from "fs/promises"
import { join } from "path"
import { getUploadRoot } from "@/lib/upload-path"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { logPlayerProfileActivity, PLAYER_PROFILE_ACTION_TYPES } from "@/lib/player-profile-activity"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

const PLAYER_IMAGES_BUCKET = "player-images"

/**
 * Ensure the player-images bucket exists (public). Idempotent; safe to call on every upload.
 */
async function ensurePlayerImagesBucket(supabase: ReturnType<typeof getSupabaseServer>) {
  const { error } = await supabase.storage.createBucket(PLAYER_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  })
  if (error && error.message?.toLowerCase().includes("already exists")) return
  if (error) console.warn("[player-images bucket]", error.message)
}

/**
 * Extract storage object path from a Supabase Storage public URL for player-images.
 * Returns null if the URL is not a player-images storage URL.
 */
function getStoragePathFromImageUrl(imageUrl: string): string | null {
  try {
    const u = new URL(imageUrl)
    const match = u.pathname.match(/\/storage\/v1\/object\/public\/player-images\/(.+)$/)
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

/**
 * POST /api/roster/[playerAccountId]/image
 * Uploads a player image to Supabase Storage. Coaches can upload for any player; players can upload only their own photo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ playerAccountId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerAccountId: segment } = await params
    if (!segment) {
      return NextResponse.json({ error: "playerAccountId route segment is required" }, { status: 400 })
    }

    const teamIdHint = new URL(request.url).searchParams.get("teamId")
    const resolvedPlayerId = await resolveRosterApiPlayerUuid(teamIdHint, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const supabase = getSupabaseServer()

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", resolvedPlayerId)
      .maybeSingle()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const teamId = (player as { team_id: string }).team_id
    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
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

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only images are allowed." }, { status: 400 })
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 })
    }

    await ensurePlayerImagesBucket(supabase)

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const secureFileName = `${timestamp}-${random}-${resolvedPlayerId}.webp`
    const storagePath = `teams/${teamId}/players/${resolvedPlayerId}/${secureFileName}`

    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const buffer = await sharp(rawBuffer)
      .rotate()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    const { error: uploadError } = await supabase.storage
      .from(PLAYER_IMAGES_BUCKET)
      .upload(storagePath, buffer, {
        contentType: "image/webp",
        upsert: false,
      })

    if (uploadError) {
      console.error("[POST /api/roster/[playerAccountId]/image] upload", uploadError)
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(PLAYER_IMAGES_BUCKET).getPublicUrl(storagePath)
    const fileUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from("players")
      .update({ image_url: fileUrl })
      .eq("id", resolvedPlayerId)

    if (updateError) {
      console.error("[POST /api/roster/[playerAccountId]/image]", updateError)
      return NextResponse.json({ error: "Failed to update player image" }, { status: 500 })
    }

    await logPlayerProfileActivity({
      playerId: resolvedPlayerId,
      teamId,
      actorId: session.user.id,
      actionType: PLAYER_PROFILE_ACTION_TYPES.PHOTO_CHANGED,
      targetType: "player",
      targetId: resolvedPlayerId,
    })

    return NextResponse.json({ imageUrl: fileUrl })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload image"
    console.error("[POST /api/roster/[playerAccountId]/image]", error)
    return NextResponse.json(
      { error: String(message).includes("Access denied") ? "Access denied" : message },
      { status: String(message).includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/roster/[playerAccountId]/image
 * Removes a player image from Storage (if Supabase URL) or filesystem (legacy), and clears image_url.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playerAccountId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerAccountId: segment } = await params
    if (!segment) {
      return NextResponse.json({ error: "playerAccountId route segment is required" }, { status: 400 })
    }

    const teamIdHint = new URL(request.url).searchParams.get("teamId")
    const resolvedPlayerId = await resolveRosterApiPlayerUuid(teamIdHint, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const supabase = getSupabaseServer()

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, team_id, user_id, image_url")
      .eq("id", resolvedPlayerId)
      .maybeSingle()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const teamId = (player as { team_id: string }).team_id
    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    const isCoach = membership ? canEditRoster(membership.role) : false
    const isOwnProfile = (player as { user_id: string | null }).user_id === session.user.id
    if (!isCoach && !isOwnProfile) {
      return NextResponse.json({ error: "You can only remove your own photo." }, { status: 403 })
    }

    const imageUrl = (player as { image_url?: string }).image_url

    if (imageUrl) {
      const storagePath = getStoragePathFromImageUrl(imageUrl)
      if (storagePath) {
        await supabase.storage.from(PLAYER_IMAGES_BUCKET).remove([storagePath])
      } else if (imageUrl.startsWith("/api/uploads/players/")) {
        const fileName = imageUrl.replace("/api/uploads/players/", "")
        const filePath = join(getUploadRoot(), "uploads", "players", fileName)
        try {
          await unlink(filePath)
        } catch {
          // Ignore if file already missing (ephemeral /tmp, etc.)
        }
      }
    }

    const { error: updateError } = await supabase
      .from("players")
      .update({ image_url: null })
      .eq("id", resolvedPlayerId)

    if (updateError) {
      console.error("[DELETE /api/roster/[playerAccountId]/image]", updateError)
      return NextResponse.json({ error: "Failed to remove player image" }, { status: 500 })
    }

    await logPlayerProfileActivity({
      playerId: resolvedPlayerId,
      teamId,
      actorId: session.user.id,
      actionType: PLAYER_PROFILE_ACTION_TYPES.PHOTO_REMOVED,
      targetType: "player",
      targetId: resolvedPlayerId,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove image"
    console.error("[DELETE /api/roster/[playerAccountId]/image]", error)
    return NextResponse.json(
      { error: String(message).includes("Access denied") ? "Access denied" : message },
      { status: String(message).includes("Access denied") ? 403 : 500 }
    )
  }
}
