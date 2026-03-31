import { notFound } from "next/navigation"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { loadAthleticDepartmentDetail } from "@/lib/admin/athletic-departments-data"
import { OperatorAthleticDepartmentDetail } from "@/components/admin/operator-athletic-department-detail"

export default async function AdminAthleticDepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()
  const data = await safeAdminDbQuery(() => loadAthleticDepartmentDetail(supabase, id), null)
  if (!data) {
    notFound()
  }
  return <OperatorAthleticDepartmentDetail adId={id} initial={data} />
}
