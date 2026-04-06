import { NextResponse } from "next/server"
import { isSupabaseSchemaObjectMissingError } from "@/lib/admin/supabase-schema-error"
import { requireAnyPermissionForApi } from "@/lib/permissions/platform-permissions"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export const runtime = "nodejs"

/** Compact role list for admin user assignment (manage users or manage roles). */
export async function GET() {
  const access = await requireAnyPermissionForApi(["manage_users", "manage_roles_permissions"])
  if (!access.ok) {
    return access.response
  }

  const supabase = getSupabaseServer()
  const { data, error } = await supabase.from("platform_roles").select("id, key, name, role_type, is_active").order("name")

  if (error) {
    if (isSupabaseSchemaObjectMissingError(error)) {
      return NextResponse.json({ ok: true, roles: [], source: "unavailable" })
    }
    console.error("[platform-role-options]", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    source: "database",
    roles: data ?? [],
  })
}
