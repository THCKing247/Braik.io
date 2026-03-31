import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { loadAthleticDepartmentsListRows } from "@/lib/admin/athletic-departments-data"
import { OperatorAthleticDepartments } from "@/components/admin/operator-athletic-departments"

export default async function AdminAthleticDepartmentsPage() {
  const supabase = getSupabaseServer()
  const rows = await safeAdminDbQuery(() => loadAthleticDepartmentsListRows(supabase), [])
  return <OperatorAthleticDepartments initialRows={rows} />
}
