import Link from "next/link"
import { PlatformRoleForm } from "@/components/admin/platform-roles/platform-role-form"

export default function AdminNewRolePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/roles" className="text-xs text-cyan-300 hover:underline">
          ← Roles & Permissions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Create Role</h1>
        <p className="mt-1 text-sm text-white/65">Define a name, key, and permission set for a new platform role.</p>
      </div>
      <PlatformRoleForm />
    </div>
  )
}
