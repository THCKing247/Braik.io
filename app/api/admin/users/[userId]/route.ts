import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { USER_ROLE_VALUES, type UserRole } from "@/lib/auth/user-roles"

type PatchBody = {
  name?: string
  email?: string
  role?: string
  status?: string
  aiTier?: string
  aiAutoRechargeEnabled?: boolean
}

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
  return NextResponse.json(user)
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
  if (typeof body.status === "string" && ["active", "DISABLED", "suspended", "deactivated"].includes(body.status.toLowerCase())) {
    update.status = body.status
  }
  if (typeof body.role === "string") {
    const role = body.role.trim().toLowerCase().replace(/-/g, "_")
    if (USER_ROLE_VALUES.includes(role as UserRole)) {
      update.role = role
    }
  }
  if (typeof body.aiTier === "string") update.ai_tier = body.aiTier
  if (typeof body.aiAutoRechargeEnabled === "boolean") update.ai_auto_recharge_enabled = body.aiAutoRechargeEnabled

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const supabase = getSupabaseServer()
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
