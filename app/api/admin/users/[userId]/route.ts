import { NextRequest, NextResponse } from "next/server"
import { countUsersWithPlatformRoleExcept } from "@/lib/admin/count-platform-role-assignments"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { USER_ROLE_VALUES, type UserRole } from "@/lib/auth/user-roles"
import { ACCOUNT_STATUS_VALUES } from "@/lib/account/account-status"
import { requirePermissionForApi } from "@/lib/permissions/platform-permissions"
import { syncUserPlatformRoleMirror } from "@/lib/permissions/sync-user-platform-role"
import { isSupabaseSchemaObjectMissingError } from "@/lib/admin/supabase-schema-error"

type PatchBody = {
  name?: string
  email?: string
  role?: string
  status?: string
  aiTier?: string
  aiAutoRechargeEnabled?: boolean
  platformRoleId?: string | null
  videoPermissions?: {
    can_view_video?: boolean
    can_upload_video?: boolean
    can_create_clips?: boolean
    can_share_clips?: boolean
    can_delete_video?: boolean
  }
}

const STATUS_ALLOW = new Set(ACCOUNT_STATUS_VALUES.map((s) => s.toLowerCase()))

async function getPlatformAdminRoleId(supabase: ReturnType<typeof getSupabaseServer>): Promise<string | null> {
  const { data } = await supabase.from("platform_roles").select("id").eq("key", "platform_admin").maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { userId } = await params
  const supabase = getSupabaseServer()

  let user: Record<string, unknown> | null = null
  let error: { message: string } | null = null

  const primary = await supabase
    .from("users")
    .select("id, email, name, role, status, created_at, last_login_at, platform_role_id")
    .eq("id", userId)
    .maybeSingle()

  if (primary.error) {
    if (isSupabaseSchemaObjectMissingError(primary.error) || primary.error.message?.includes("platform_role_id")) {
      const fb = await supabase
        .from("users")
        .select("id, email, name, role, status, created_at, last_login_at")
        .eq("id", userId)
        .maybeSingle()
      user = fb.data as Record<string, unknown> | null
      error = fb.error
    } else {
      error = primary.error
    }
  } else {
    user = primary.data as Record<string, unknown> | null
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
  }

  let platformRole: { id: string; key: string; name: string } | null = null
  const prid = user.platform_role_id as string | undefined
  if (prid) {
    const { data: pr } = await supabase.from("platform_roles").select("id, key, name").eq("id", prid).maybeSingle()
    if (pr) platformRole = pr as { id: string; key: string; name: string }
  }

  const { data: videoPerms } = await supabase
    .from("user_video_permissions")
    .select("can_view_video, can_upload_video, can_create_clips, can_share_clips, can_delete_video")
    .eq("user_id", userId)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    ...user,
    platformRole,
    videoPermissions: videoPerms ?? null,
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const access = await requirePermissionForApi("manage_users")
  if (!access.ok) return access.response

  const { userId } = await params
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const adminRoleId = await getPlatformAdminRoleId(supabase)

  const { data: existing } = await supabase.from("users").select("platform_role_id").eq("id", userId).maybeSingle()
  const currentPlatformRoleId = (existing as { platform_role_id?: string | null } | null)?.platform_role_id ?? null

  if (body.platformRoleId !== undefined && adminRoleId) {
    const newId = body.platformRoleId === null || body.platformRoleId === "" ? null : body.platformRoleId
    const wasAdmin = currentPlatformRoleId === adminRoleId
    const willBeAdmin = newId === adminRoleId
    if (wasAdmin && !willBeAdmin) {
      const remaining = await countUsersWithPlatformRoleExcept(supabase, adminRoleId, userId)
      if (remaining === 0) {
        return NextResponse.json(
          { ok: false, error: "Cannot remove the last platform administrator." },
          { status: 409 }
        )
      }
    }
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
  if (body.platformRoleId !== undefined) {
    update.platform_role_id = body.platformRoleId === null || body.platformRoleId === "" ? null : body.platformRoleId
  }

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
      return NextResponse.json({ ok: false, error: vErr.message }, { status: 500 })
    }
  }

  if (Object.keys(update).length === 0) {
    if (!body.videoPermissions && body.platformRoleId === undefined) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 })
    }
    if (body.platformRoleId !== undefined) {
      const newId = body.platformRoleId === null || body.platformRoleId === "" ? null : body.platformRoleId
      const sync = await syncUserPlatformRoleMirror(supabase, userId, newId)
      if (!sync.ok) {
        return NextResponse.json({ ok: false, error: sync.message }, { status: 500 })
      }
    }
    const { data: videoPerms } = await supabase
      .from("user_video_permissions")
      .select("can_view_video, can_upload_video, can_create_clips, can_share_clips, can_delete_video")
      .eq("user_id", userId)
      .maybeSingle()
    return NextResponse.json({ ok: true, updated: true, videoPermissions: videoPerms ?? null })
  }

  const { data, error } = await supabase.from("users").update(update).eq("id", userId).select().maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  if (body.platformRoleId !== undefined) {
    const newId = body.platformRoleId === null || body.platformRoleId === "" ? null : body.platformRoleId
    const sync = await syncUserPlatformRoleMirror(supabase, userId, newId)
    if (!sync.ok) {
      return NextResponse.json({ ok: false, error: sync.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, ...(data ?? { updated: true }) })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const access = await requirePermissionForApi("manage_users")
  if (!access.ok) return access.response

  const { userId } = await params
  const supabase = getSupabaseServer()
  const adminRoleId = await getPlatformAdminRoleId(supabase)

  if (adminRoleId) {
    const { data: victim } = await supabase.from("users").select("platform_role_id").eq("id", userId).maybeSingle()
    const vid = (victim as { platform_role_id?: string | null } | null)?.platform_role_id
    if (vid === adminRoleId) {
      const remaining = await countUsersWithPlatformRoleExcept(supabase, adminRoleId, userId)
      if (remaining === 0) {
        return NextResponse.json(
          { ok: false, error: "Cannot delete the last platform administrator." },
          { status: 409 }
        )
      }
    }
  }

  const { error } = await supabase.from("users").delete().eq("id", userId)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deleted: true })
}
