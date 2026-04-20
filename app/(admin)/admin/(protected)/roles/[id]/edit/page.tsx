import Link from "next/link"
import { PlatformRoleForm } from "@/components/admin/platform-roles/platform-role-form"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export default async function AdminEditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/roles" className={cn(adminUi.linkSubtle, "text-sm")}>
          ← Roles &amp; permissions
        </Link>
        <h1 className="mt-2 font-athletic text-2xl font-bold uppercase tracking-wide text-admin-primary">Edit role</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Update metadata, status, and permissions. Changes apply to users with this role.
        </p>
      </div>
      <PlatformRoleForm roleId={id} />
    </div>
  )
}
