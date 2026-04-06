import Link from "next/link"
import { PlatformRoleForm } from "@/components/admin/platform-roles/platform-role-form"

export default async function AdminEditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/roles" className="text-xs text-cyan-300 hover:underline">
          ← Roles & Permissions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Edit Role</h1>
        <p className="mt-1 text-sm text-white/65">Update metadata, status, and permissions. Changes apply to users with this role.</p>
      </div>
      <PlatformRoleForm roleId={id} />
    </div>
  )
}
