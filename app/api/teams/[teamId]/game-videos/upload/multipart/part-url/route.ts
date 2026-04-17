import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import { presignedUploadPartUrl } from "@/lib/video/r2-client"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()
    const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { upload: true })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    let body: { videoId?: string; uploadId?: string; partNumber?: number }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : ""
    const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : ""
    const partNumber = Number(body.partNumber)

    if (!videoId || !uploadId || !Number.isFinite(partNumber) || partNumber < 1) {
      return NextResponse.json({ error: "videoId, uploadId, and positive partNumber required" }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from("game_videos")
      .select("id, team_id, storage_key, metadata, upload_status")
      .eq("id", videoId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    const meta = (row as { metadata?: Record<string, unknown> }).metadata ?? {}
    const storedId = typeof meta.multipartUploadId === "string" ? meta.multipartUploadId : null
    if (!storedId || storedId !== uploadId) {
      return NextResponse.json({ error: "Multipart session mismatch" }, { status: 400 })
    }

    const key = (row as { storage_key?: string | null }).storage_key
    if (!key) {
      return NextResponse.json({ error: "Missing storage key" }, { status: 500 })
    }

    const url = await presignedUploadPartUrl(key, uploadId, partNumber)
    if (!url) {
      return NextResponse.json({ error: "Could not presign part URL" }, { status: 500 })
    }

    return NextResponse.json({ uploadUrl: url, partNumber, expiresInSeconds: 3600 })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}
