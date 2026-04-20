import Link from "next/link"
import { PlatformRoleForm } from "@/components/admin/platform-roles/platform-role-form"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export default function AdminNewRolePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/roles" className={cn(adminUi.linkSubtle, "text-sm")}>
          ← Roles &amp; permissions
        </Link>
        <h1 className="mt-2 font-athletic text-2xl font-bold uppercase tracking-wide text-admin-primary">Create role</h1>
        <p className="mt-1 text-sm text-admin-muted">Define a name, key, and permission set for a new platform role.</p>
      </div>
      <PlatformRoleForm />
    </div>
  )
}
