import { NextResponse } from "next/server"
import { requireManageRolesForApi } from "@/lib/permissions/platform-permissions"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { PLATFORM_PERMISSION_SECTION_ORDER } from "@/lib/permissions/platform-permission-keys"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireManageRolesForApi()
  if (!access.ok) {
    return access.response
  }

  const supabase = getSupabaseServer()
  const { data: rows, error } = await supabase
    .from("platform_permissions")
    .select("key, section, label, description")
    .order("section")
    .order("label")

  if (error) {
    console.error("platform-permissions list:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    permissions: rows ?? [],
    sectionOrder: PLATFORM_PERMISSION_SECTION_ORDER,
  })
}
