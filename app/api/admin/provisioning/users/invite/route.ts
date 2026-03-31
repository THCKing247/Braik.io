import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { adminInviteUser } from "@/lib/admin/admin-invite-user"
import { USER_ROLE_VALUES, type UserRole } from "@/lib/auth/user-roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requestAppOrigin } from "@/lib/dashboard/build-full-dashboard-bootstrap"

export async function POST(request: Request) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  let body: {
    email?: string
    fullName?: string
    role?: string
    teamId?: string | null
    organizationId?: string | null
    accountStatus?: string
    video?: {
      can_view_video?: boolean
      can_upload_video?: boolean
      can_create_clips?: boolean
      can_share_clips?: boolean
      can_delete_video?: boolean
    }
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : ""
  const roleRaw = typeof body.role === "string" ? body.role.trim().toLowerCase().replace(/-/g, "_") : ""
  const teamId = typeof body.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : null
  const organizationId =
    typeof body.organizationId === "string" && body.organizationId.trim() ? body.organizationId.trim() : null
  const accountStatus =
    typeof body.accountStatus === "string" && body.accountStatus.trim()
      ? body.accountStatus.trim()
      : "invited"

  if (!email || !fullName || !roleRaw || !USER_ROLE_VALUES.includes(roleRaw as UserRole)) {
    return NextResponse.json({ error: "email, fullName, and a valid role are required" }, { status: 400 })
  }

  if (teamId) {
    const supabase = getSupabaseServer()
    const { data: t } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!t) {
      return NextResponse.json({ error: "teamId not found" }, { status: 400 })
    }
  }

  const appOrigin = requestAppOrigin(request)
  const video = body.video ?? {}

  const result = await adminInviteUser({
    email,
    fullName,
    userRole: roleRaw as UserRole,
    teamId,
    organizationId,
    accountStatus,
    video: {
      can_view_video: video.can_view_video === true,
      can_upload_video: video.can_upload_video === true,
      can_create_clips: video.can_create_clips === true,
      can_share_clips: video.can_share_clips === true,
      can_delete_video: video.can_delete_video === true,
    },
    invitedByUserId: access.context.actorId,
    appOrigin,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true, userId: result.userId })
}

export const runtime = "nodejs"
