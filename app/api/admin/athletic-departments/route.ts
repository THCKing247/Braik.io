import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { loadAthleticDepartmentsListRows } from "@/lib/admin/athletic-departments-data"

export async function GET() {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const supabase = getSupabaseServer()
  try {
    const rows = await loadAthleticDepartmentsListRows(supabase)
    return NextResponse.json({ athleticDepartments: rows })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
