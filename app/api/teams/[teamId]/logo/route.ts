import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

const TEAM_LOGOS_BUCKET = "team-logos"
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg"]
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024 // 3MB

/**
 * Ensure the team-logos bucket exists (public). Idempotent; safe to call on every upload.
 */
async function ensureTeamLogosBucket(supabase: ReturnType<typeof getSupabaseServer>) {
  const { error } = await supabase.storage.createBucket(TEAM_LOGOS_BUCKET, {
    public: true,
    fileSizeLimit: "3MB",
    allowedMimeTypes: ["image/png", "image/jpeg"],
  })
  if (error && error.message?.toLowerCase().includes("already exists")) return
  if (error) console.warn("[team-logos bucket]", error.message)
}

/**
 * Extract storage object path from a Supabase Storage public URL for team-logos.
 * Returns null if the URL is not a team-logos storage URL.
 */
function getStoragePathFromLogoUrl(logoUrl: string): string | null {
  try {
    const u = new URL(logoUrl)
    const match = u.pathname.match(/\/storage\/v1\/object\/public\/team-logos\/(.+)$/)
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

/**
 * POST /api/teams/[teamId]/logo
 * Upload a team logo image (PNG or JPG, max 3MB). Replaces existing logo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage")

    const supabase = getSupabaseServer()

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    const mime = (file.type || "").toLowerCase()
    if (!ALLOWED_MIME_TYPES.includes(mime)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PNG and JPG/JPEG are allowed." },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 3MB limit" },
        { status: 400 }
      )
    }

    await ensureTeamLogosBucket(supabase)

    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 80)
    const ext = mime === "image/png" ? "png" : "jpg"
    const storagePath = `${teamId}/${timestamp}-${sanitizedName || "logo"}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from(TEAM_LOGOS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("[POST /api/teams/[teamId]/logo] upload", uploadError)
      return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(TEAM_LOGOS_BUCKET).getPublicUrl(storagePath)
    const logoUrl = urlData.publicUrl

    // Get current logo to delete old file after successful update
    const { data: teamRow } = await supabase
      .from("teams")
      .select("logo_url")
      .eq("id", teamId)
      .single()

    const { error: updateError } = await supabase
      .from("teams")
      .update({ logo_url: logoUrl })
      .eq("id", teamId)

    if (updateError) {
      console.error("[POST /api/teams/[teamId]/logo] update", updateError)
      await supabase.storage.from(TEAM_LOGOS_BUCKET).remove([storagePath])
      return NextResponse.json({ error: "Failed to save logo to team" }, { status: 500 })
    }

    const oldLogoUrl = (teamRow as { logo_url?: string } | null)?.logo_url
    if (oldLogoUrl) {
      const oldPath = getStoragePathFromLogoUrl(oldLogoUrl)
      if (oldPath) {
        await supabase.storage.from(TEAM_LOGOS_BUCKET).remove([oldPath])
      }
    }

    return NextResponse.json({ logoUrl })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload logo"
    if (String(message).includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/teams/[teamId]/logo]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/teams/[teamId]/logo
 * Remove team logo: clear logo_url and delete file from storage if it's in team-logos bucket.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage")

    const supabase = getSupabaseServer()

    const { data: teamRow, error: fetchError } = await supabase
      .from("teams")
      .select("logo_url")
      .eq("id", teamId)
      .single()

    if (fetchError || !teamRow) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const logoUrl = (teamRow as { logo_url?: string }).logo_url
    if (logoUrl) {
      const storagePath = getStoragePathFromLogoUrl(logoUrl)
      if (storagePath) {
        await supabase.storage.from(TEAM_LOGOS_BUCKET).remove([storagePath])
      }
    }

    const { error: updateError } = await supabase
      .from("teams")
      .update({ logo_url: null })
      .eq("id", teamId)

    if (updateError) {
      console.error("[DELETE /api/teams/[teamId]/logo]", updateError)
      return NextResponse.json({ error: "Failed to remove logo" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove logo"
    if (String(message).includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[DELETE /api/teams/[teamId]/logo]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
