import { OperatorPlatformRoles } from "@/components/admin/platform-roles/operator-platform-roles"

export default function AdminRolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-white/65">Manage platform roles and control what each role can access.</p>
      </div>
      <OperatorPlatformRoles />
    </div>
  )
}
