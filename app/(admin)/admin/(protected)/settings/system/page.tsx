import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { listSystemConfig } from "@/lib/admin/system-config-store"
import { SystemSettingsPanel } from "@/components/admin/system-settings-panel"

export default async function AdminSystemSettingsPage() {
  const initialRows = await listSystemConfig(200)
  const teams = await safeAdminDbQuery(async () => {
    const supabase = getSupabaseServer()
    const { data } = await supabase.from("teams").select("id, name").order("name", { ascending: true }).limit(500)
    return (data ?? []).map((t) => ({ id: t.id as string, name: t.name as string }))
  }, [])

  return <SystemSettingsPanel initialRows={initialRows} teams={teams} />
}
