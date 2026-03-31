import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { USER_ROLE_VALUES, type UserRole } from "@/lib/auth/user-roles"
import { ACCOUNT_STATUS_VALUES } from "@/lib/account/account-status"

type PatchBody = {
  name?: string
  email?: string
  role?: string
  status?: string
  aiTier?: string
  aiAutoRechargeEnabled?: boolean
  videoPermissions?: {
    can_view_video?: boolean
    can_upload_video?: boolean
    can_create_clips?: boolean
    can_share_clips?: boolean
    can_delete_video?: boolean
  }
}

const STATUS_ALLOW = new Set(ACCOUNT_STATUS_VALUES.map((s) => s.toLowerCase()))

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { userId } = await params
  const supabase = getSupabaseServer()
  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, role, status, created_at, last_login_at")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const { data: videoPerms } = await supabase
    .from("user_video_permissions")
    .select(
      "can_view_video, can_upload_video, can_create_clips, can_share_clips, can_delete_video"
    )
    .eq("user_id", userId)
    .maybeSingle()

  return NextResponse.json({
    ...user,
    videoPermissions: videoPerms ?? null,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { userId } = await params
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof body.name === "string") update.name = body.name.trim() || null
  if (typeof body.email === "string") update.email = body.email.trim().toLowerCase()
  if (typeof body.status === "string") {
    const st = body.status.trim()
    if (STATUS_ALLOW.has(st.toLowerCase())) {
      update.status = st
    }
  }
  if (typeof body.role === "string") {
    const role = body.role.trim().toLowerCase().replace(/-/g, "_")
    if (USER_ROLE_VALUES.includes(role as UserRole)) {
      update.role = role
    }
  }
  if (typeof body.aiTier === "string") update.ai_tier = body.aiTier
  if (typeof body.aiAutoRechargeEnabled === "boolean") update.ai_auto_recharge_enabled = body.aiAutoRechargeEnabled

  const supabase = getSupabaseServer()

  if (body.videoPermissions && typeof body.videoPermissions === "object") {
    const v = body.videoPermissions
    const { error: vErr } = await supabase.from("user_video_permissions").upsert(
      {
        user_id: userId,
        can_view_video: v.can_view_video === true,
        can_upload_video: v.can_upload_video === true,
        can_create_clips: v.can_create_clips === true,
        can_share_clips: v.can_share_clips === true,
        can_delete_video: v.can_delete_video === true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }
  }

  if (Object.keys(update).length === 0) {
    if (!body.videoPermissions) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }
    const { data: videoPerms } = await supabase
      .from("user_video_permissions")
      .select(
        "can_view_video, can_upload_video, can_create_clips, can_share_clips, can_delete_video"
      )
      .eq("user_id", userId)
      .maybeSingle()
    return NextResponse.json({ updated: true, videoPermissions: videoPerms ?? null })
  }

  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", userId)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? { updated: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { userId } = await params
  const supabase = getSupabaseServer()
  const { error } = await supabase.from("users").delete().eq("id", userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ deleted: true })
}
