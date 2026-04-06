import Link from "next/link"
import { PlatformRoleView } from "@/components/admin/platform-roles/platform-role-view"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export default async function AdminRoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/roles" className={cn(adminUi.linkSubtle, "text-sm")}>
          ← Roles &amp; permissions
        </Link>
        <h1 className="mt-2 font-athletic text-2xl font-bold uppercase tracking-wide text-white">Role details</h1>
      </div>
      <PlatformRoleView roleId={id} />
    </div>
  )
}
