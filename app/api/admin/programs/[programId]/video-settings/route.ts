import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"
import { assertTier, type VideoCapabilityTier } from "@/lib/video/tier-defaults"

export const runtime = "nodejs"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { programId } = await params
  const supabase = getSupabaseServer()

  const { data: program, error: pErr } = await supabase
    .from("programs")
    .select("id, program_name")
    .eq("id", programId)
    .maybeSingle()
  if (pErr || !program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 })
  }

  const { data: row } = await supabase.from("program_video_settings").select("*").eq("program_id", programId).maybeSingle()

  return NextResponse.json({ program, settings: row ?? null })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { programId } = await params
  const supabase = getSupabaseServer()

  const { data: program, error: pErr } = await supabase.from("programs").select("id").eq("id", programId).maybeSingle()
  if (pErr || !program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const insert: Record<string, unknown> = { program_id: programId, updated_at: new Date().toISOString() }

  if (typeof body.capability_tier === "string") {
    insert.capability_tier = assertTier(body.capability_tier) as VideoCapabilityTier
  }
  if (body.storage_cap_bytes != null) {
    const n = Number(body.storage_cap_bytes)
    if (Number.isFinite(n) && n > 0) insert.storage_cap_bytes = Math.floor(n)
  }
  if (body.storage_cap_bytes === null) {
    insert.storage_cap_bytes = null
  }
  if (body.shared_storage_scope === "team" || body.shared_storage_scope === "program") {
    insert.shared_storage_scope = body.shared_storage_scope
  }
  for (const k of [
    "ai_video_features_enabled",
    "tagging_enabled",
    "cross_team_library_enabled",
    "bulk_management_enabled",
    "advanced_clip_tools_enabled",
    "priority_processing_enabled",
  ] as const) {
    if (typeof body[k] === "boolean") insert[k] = body[k]
  }
  if (body.max_clips === null) {
    insert.max_clips = null
  } else if (body.max_clips != null) {
    const m = Number(body.max_clips)
    if (Number.isFinite(m) && m >= 0) insert.max_clips = Math.floor(m)
  }

  const { data: upserted, error } = await supabase
    .from("program_video_settings")
    .upsert(insert, { onConflict: "program_id" })
    .select("*")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAdminAuditLog({
    actorId: access.context.actorId,
    action: "program_video_settings_upsert",
    targetType: "program",
    targetId: programId,
    metadata: { insert },
  }).catch(() => undefined)

  return NextResponse.json({ settings: upserted })
}
