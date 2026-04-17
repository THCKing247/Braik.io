import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import {
  VIDEO_MULTIPART_PART_SIZE_BYTES,
  VIDEO_MULTIPART_THRESHOLD_BYTES,
  VIDEO_UPLOAD_ALLOWED_MIME,
  VIDEO_UPLOAD_MAX_BYTES_SINGLE_PUT,
  inferMimeFromFileName,
} from "@/lib/video/constants"
import { readR2Env, createMultipartUpload, presignedPutObjectUrl } from "@/lib/video/r2-client"
import { buildGameVideoStorageKey, sanitizeVideoFileName } from "@/lib/video/storage-keys"
import { resolveTeamOrgProgramIds } from "@/lib/video/team-scope"
import { resolveEffectiveVideoEntitlements } from "@/lib/video/entitlements"
import { resolveQuotaBaselineBytes, wouldExceedQuota } from "@/lib/video/quota"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)
    const supabase = getSupabaseServer()

    const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { upload: true, view: true }, {
      portalRole: session.user.role,
      isPlatformOwner: session.user.isPlatformOwner === true,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    if (!readR2Env()) {
      return NextResponse.json(
        { error: "Video storage is not configured (R2). Contact the platform administrator." },
        { status: 503 }
      )
    }

    let body: {
      fileName?: string
      mimeType?: string | null
      sizeBytes?: number
      title?: string | null
      multipart?: boolean
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : ""
    const sizeBytes = Number(body.sizeBytes)
    let mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : ""
    if (!fileName || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json({ error: "fileName and positive sizeBytes are required" }, { status: 400 })
    }

    if (!mimeType) {
      mimeType = inferMimeFromFileName(fileName) ?? ""
    }
    if (!(VIDEO_UPLOAD_ALLOWED_MIME as readonly string[]).includes(mimeType)) {
      return NextResponse.json({ error: "Video file type not allowed" }, { status: 400 })
    }

    const useMultipart = Boolean(body.multipart) || sizeBytes > VIDEO_MULTIPART_THRESHOLD_BYTES
    const maxAllowed = useMultipart ? Number.MAX_SAFE_INTEGER : VIDEO_UPLOAD_MAX_BYTES_SINGLE_PUT
    if (sizeBytes > maxAllowed) {
      return NextResponse.json({ error: "File exceeds maximum upload size for this mode" }, { status: 400 })
    }

    const entitlements = await resolveEffectiveVideoEntitlements(supabase, teamId)
    if (!entitlements) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const scope = await resolveTeamOrgProgramIds(supabase, teamId)
    if (!scope) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const baseline = await resolveQuotaBaselineBytes(supabase, teamId, scope.programId, entitlements)
    if (wouldExceedQuota(baseline.usedBytes, baseline.capBytes, sizeBytes)) {
      return NextResponse.json(
        { error: "Storage quota exceeded for this team or program pool.", code: "QUOTA_EXCEEDED" },
        { status: 409 }
      )
    }

    const videoId = randomUUID()
    const safeName = sanitizeVideoFileName(fileName)
    const storageKey = buildGameVideoStorageKey({ teamId, videoId, safeFileName: safeName })

    const title =
      typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim() : safeName.replace(/\.[^.]+$/, "")

    const { error: insErr } = await supabase.from("game_videos").insert({
      id: videoId,
      team_id: teamId,
      program_id: scope.programId,
      org_id: scope.organizationId,
      uploaded_by: session.user.id,
      title,
      storage_path: storageKey,
      storage_key: storageKey,
      original_filename: fileName,
      mime_type: mimeType,
      file_size_bytes: sizeBytes,
      duration_seconds: null,
      upload_status: "pending",
      processing_status: "none",
      metadata: {},
    })

    if (insErr) {
      console.error("[upload/init]", insErr.message)
      return NextResponse.json({ error: "Failed to register upload" }, { status: 500 })
    }

    if (!useMultipart) {
      const uploadUrl = await presignedPutObjectUrl(storageKey, mimeType)
      if (!uploadUrl) {
        await supabase.from("game_videos").delete().eq("id", videoId)
        return NextResponse.json({ error: "Could not prepare upload URL" }, { status: 500 })
      }

      await supabase
        .from("game_videos")
        .update({
          upload_status: "uploading",
          metadata: { presignedMode: "single_put" },
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId)

      return NextResponse.json({
        mode: "single_put" as const,
        videoId,
        storageKey,
        uploadUrl,
        expiresInSeconds: 3600,
      })
    }

    const mp = await createMultipartUpload(storageKey, mimeType)
    if (!mp?.uploadId) {
      await supabase.from("game_videos").delete().eq("id", videoId)
      return NextResponse.json({ error: "Could not start multipart upload" }, { status: 500 })
    }

    const totalParts = Math.ceil(sizeBytes / VIDEO_MULTIPART_PART_SIZE_BYTES)

    await supabase
      .from("game_videos")
      .update({
        upload_status: "uploading",
        metadata: {
          presignedMode: "multipart",
          multipartUploadId: mp.uploadId,
          expectedSizeBytes: sizeBytes,
          partSizeBytes: VIDEO_MULTIPART_PART_SIZE_BYTES,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", videoId)

    return NextResponse.json({
      mode: "multipart" as const,
      videoId,
      storageKey,
      uploadId: mp.uploadId,
      partSizeBytes: VIDEO_MULTIPART_PART_SIZE_BYTES,
      totalParts,
      mimeType,
    })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}
