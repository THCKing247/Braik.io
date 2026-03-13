import { NextResponse } from "next/server"
import { writeFile, mkdir, unlink } from "fs/promises"
import { join } from "path"
import { getUploadRoot } from "@/lib/upload-path"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { logPlayerProfileActivity, PLAYER_PROFILE_ACTION_TYPES } from "@/lib/player-profile-activity"

/**
 * GET /api/roster/[playerId]/documents?teamId=xxx
 * List documents for this player. Coach: any player on team. Player: own profile only.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!playerId || !teamId) {
      return NextResponse.json({ error: "playerId and teamId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    const isCoach = membership ? canEditRoster(membership.role) : false
    const isOwn = (player as { user_id: string | null }).user_id === session.user.id
    if (!isCoach && !isOwn) {
      return NextResponse.json({ error: "You can only view your own documents." }, { status: 403 })
    }

    let q = supabase
      .from("player_documents")
      .select("id, player_id, team_id, title, file_name, file_url, file_size, mime_type, category, created_at, created_by, visible_to_player")
      .eq("player_id", playerId)
      .eq("team_id", teamId)
    if (!isCoach) {
      q = q.eq("visible_to_player", true)
    }
    const { data: rows, error } = await q.order("created_at", { ascending: false })

    if (error) {
      console.error("[GET /api/roster/.../documents]", error.message)
      return NextResponse.json({ error: "Failed to load documents" }, { status: 500 })
    }

    const creatorIds = [...new Set((rows ?? []).map((r) => (r as { created_by?: string }).created_by).filter(Boolean))]
    let creatorMap = new Map<string, { name: string | null }>()
    if (creatorIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, name").in("id", creatorIds)
      creatorMap = new Map((users ?? []).map((u) => [u.id, { name: u.name ?? null }]))
    }

    const documents = (rows ?? []).map((d) => {
      const createdBy = (d as { created_by?: string }).created_by
      return {
        id: (d as { id: string }).id,
        playerId: (d as { player_id: string }).player_id,
        teamId: (d as { team_id: string }).team_id,
        title: (d as { title: string }).title ?? "",
        fileName: (d as { file_name: string }).file_name ?? "",
        fileUrl: (d as { file_url?: string }).file_url ?? null,
        fileSize: (d as { file_size?: number }).file_size ?? null,
        mimeType: (d as { mime_type?: string }).mime_type ?? null,
        category: (d as { category: string }).category ?? "other",
        createdAt: (d as { created_at: string }).created_at,
        visibleToPlayer: (d as { visible_to_player?: boolean }).visible_to_player !== false,
        createdBy: createdBy ? creatorMap.get(createdBy)?.name ?? null : null,
      }
    })

    return NextResponse.json(documents)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/roster/.../documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
const MAX_SIZE = 15 * 1024 * 1024 // 15MB

/**
 * POST /api/roster/[playerId]/documents
 * Upload a document for this player. Coach only.
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
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const teamId = (player as { team_id: string }).team_id
    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can upload documents." }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const title = (formData.get("title") as string)?.trim() || "Document"
    const category = (formData.get("category") as string)?.trim() || "other"
    const visibleToPlayer = formData.get("visibleToPlayer") !== "false"

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds 15MB limit" }, { status: 400 })
    }

    const mime = file.type
    if (mime && !ALLOWED_MIME.includes(mime)) {
      return NextResponse.json(
        { error: "File type not allowed. Use PDF, images, or Word docs." },
        { status: 400 }
      )
    }

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const secureName = `${timestamp}-${random}-${sanitized}`

    const uploadsDir = join(getUploadRoot(), "uploads", "player-documents")
    await mkdir(uploadsDir, { recursive: true })
    const filePath = join(uploadsDir, secureName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const fileUrl = `/api/uploads/player-documents/${secureName}`

    const { data: doc, error: insertErr } = await supabase
      .from("player_documents")
      .insert({
        player_id: playerId,
        team_id: teamId,
        title,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type || null,
        category,
        created_by: session.user.id,
        visible_to_player: visibleToPlayer,
      })
      .select()
      .single()

    if (insertErr) {
      console.error("[POST /api/roster/.../documents]", insertErr.message)
      try { await unlink(filePath) } catch { /* ignore */ }
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 })
    }

    await logPlayerProfileActivity({
      playerId,
      teamId,
      actorId: session.user.id,
      actionType: PLAYER_PROFILE_ACTION_TYPES.DOCUMENT_UPLOADED,
      targetType: "document",
      targetId: (doc as { id: string }).id,
      metadata: { title: (doc as { title: string }).title },
    })

    return NextResponse.json({
      id: doc.id,
      playerId: doc.player_id,
      teamId: doc.team_id,
      title: doc.title,
      fileName: doc.file_name,
      fileUrl: doc.file_url,
      fileSize: doc.file_size,
      mimeType: doc.mime_type,
      category: doc.category,
      createdAt: doc.created_at,
      visibleToPlayer: (doc as { visible_to_player?: boolean }).visible_to_player !== false,
      createdBy: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/roster/.../documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
