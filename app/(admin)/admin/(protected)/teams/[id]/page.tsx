import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminTeamDetailPanel } from "@/components/admin/admin-team-detail-panel"
import { loadAdminTeamDetail } from "@/lib/admin/load-admin-team-detail"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export default async function AdminTeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await loadAdminTeamDetail(id)

  if (!result.ok && result.kind === "not_found") {
    notFound()
  }

  if (!result.ok && result.kind === "query_error") {
    return (
      <div className="space-y-6">
        <Link href="/admin/teams" className={cn(adminUi.link, "text-sm underline-offset-2")}>
          ← All teams
        </Link>
        <div className={cn(adminUi.noticeMuted, "text-sm")}>
          <p className="font-semibold text-admin-primary">Could not load this team</p>
          <p className="mt-2 text-admin-secondary">{result.message}</p>
        </div>
      </div>
    )
  }

  if (!result.ok) {
    notFound()
  }

  return <AdminTeamDetailPanel model={result.data} />
}
