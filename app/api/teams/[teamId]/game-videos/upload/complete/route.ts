import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import { headObjectMeta, completeMultipartUpload } from "@/lib/video/r2-client"
import { adjustRollupAfterUploadComplete, resolveQuotaBaselineBytes, wouldExceedQuota } from "@/lib/video/quota"
import { resolveEffectiveVideoEntitlements } from "@/lib/video/entitlements"
import { resolveTeamOrgProgramIds } from "@/lib/video/team-scope"

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
    const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { upload: true }, {
      portalRole: session.user.role,
      isPlatformOwner: session.user.isPlatformOwner === true,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    let body: {
      videoId?: string
      durationSeconds?: number | null
      mode?: "single_put" | "multipart"
      uploadId?: string
      parts?: Array<{ partNumber: number; etag: string }>
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : ""
    if (!videoId) {
      return NextResponse.json({ error: "videoId required" }, { status: 400 })
    }

    const { data: row, error: loadErr } = await supabase
      .from("game_videos")
      .select("id, team_id, storage_key, file_size_bytes, upload_status, metadata, program_id, org_id")
      .eq("id", videoId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (loadErr || !row) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    const r = row as {
      storage_key: string | null
      file_size_bytes: number | null
      metadata: Record<string, unknown> | null
    }
    const key = r.storage_key
    if (!key) {
      return NextResponse.json({ error: "Missing storage key" }, { status: 500 })
    }

    const mode = body.mode ?? (r.metadata && r.metadata.multipartUploadId ? "multipart" : "single_put")

    if (mode === "multipart") {
      const uploadId = typeof body.uploadId === "string" ? body.uploadId : (r.metadata?.multipartUploadId as string)
      const parts = Array.isArray(body.parts) ? body.parts : []
      if (!uploadId || parts.length === 0) {
        return NextResponse.json({ error: "uploadId and non-empty parts required for multipart" }, { status: 400 })
      }
      const ok = await completeMultipartUpload(
        key,
        uploadId,
        parts.map((p) => ({ ETag: p.etag, PartNumber: p.partNumber }))
      )
      if (!ok) {
        await supabase
          .from("game_videos")
          .update({
            upload_status: "failed",
            error_message: "Multipart complete failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", videoId)
        return NextResponse.json({ error: "Could not finalize multipart upload" }, { status: 500 })
      }
    }

    const head = await headObjectMeta(key)
    if (!head || head.contentLength == null) {
      await supabase
        .from("game_videos")
        .update({
          upload_status: "failed",
          error_message: "Uploaded object not found in storage",
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId)
      return NextResponse.json({ error: "Object not found in storage after upload" }, { status: 400 })
    }

    const size = head.contentLength
    const expected = Number(r.file_size_bytes ?? 0)
    if (expected > 0 && Math.abs(size - expected) > Math.max(256, expected * 0.01)) {
      // allow small variance; still accept but log
      console.warn("[upload/complete] size mismatch", { videoId, size, expected })
    }

    const ent = await resolveEffectiveVideoEntitlements(supabase, teamId)
    const scope = await resolveTeamOrgProgramIds(supabase, teamId)
    if (ent && scope) {
      const baseline = await resolveQuotaBaselineBytes(supabase, teamId, scope.programId, ent)
      // Re-check with actual size (replace expected)
      if (wouldExceedQuota(baseline.usedBytes, baseline.capBytes, size)) {
        return NextResponse.json(
          { error: "Storage quota would be exceeded with this file size.", code: "QUOTA_EXCEEDED" },
          { status: 409 }
        )
      }
    }

    const duration =
      body.durationSeconds != null && Number.isFinite(body.durationSeconds)
        ? Math.max(0, Math.floor(body.durationSeconds))
        : null

    const { error: upErr } = await supabase
      .from("game_videos")
      .update({
        file_size_bytes: size,
        upload_status: "ready",
        processing_status: "ready",
        duration_seconds: duration,
        error_message: null,
        updated_at: new Date().toISOString(),
        metadata: { ...(r.metadata ?? {}), completeAt: new Date().toISOString() },
      })
      .eq("id", videoId)

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    await adjustRollupAfterUploadComplete(supabase, teamId, size)

    return NextResponse.json({ ok: true, videoId, sizeBytes: size })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}
